import { useState, type RefObject } from "react";
import { getErrorMessage } from "@repo/api-client";
import {
  dictationExample,
  FORMS,
  formLabel,
  missingDictationItems,
  PROFESSION_LABELS,
  PROGRAM_LABELS,
  withParticle,
  type FormId,
  type Program,
  type Profession,
  type VisitDetail,
  type VisitDictationExampleLine,
  type VisitForms,
} from "@repo/shared-types";
import {
  ClipboardCheck,
  LoaderCircle,
  Mic,
  RotateCcw,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DraftReview,
  TranscriptDetails,
} from "@/features/dictation/components/draft-review";
import { MissingItems } from "@/features/dictation/components/missing-items";
import { RecordingControls } from "@/features/dictation/components/recording-controls";
import type { DictationSession } from "@/features/dictation/hooks/use-dictation-session";
import { mergeDraft } from "@/features/dictation/lib/merge-draft";
import {
  formStartValues,
  type RecordFormValues,
} from "@/features/visits/lib/record-form";

type RecordForm = Pick<
  UseFormReturn<RecordFormValues>,
  "getValues" | "setValue"
>;

type PanelVisit = Pick<
  VisitDetail,
  "formIds" | "program" | "profession" | "recipient" | "forms" | "carryOver"
>;

function Processing() {
  return (
    <div
      role="status"
      className="bg-primary-soft text-primary flex items-center gap-3 rounded-xl p-4"
    >
      <LoaderCircle className="size-6 shrink-0 animate-spin" />
      <div>
        <p className="font-bold">기록 초안을 만드는 중입니다</p>
        <p className="text-sm">
          음성을 글로 옮기고 서식 항목을 채웁니다. 보통 10~30초 걸립니다.
        </p>
      </div>
    </div>
  );
}

/** 서식들의 구술 안내를 합친다(같은 문구는 한 번). */
function dictationGuide(formIds: readonly FormId[]): string[] {
  return [...new Set(formIds.flatMap((formId) => FORMS[formId].guide))];
}

/** 녹음 전 안내: 이 방문(사업 × 직종)의 예시 문장을 따라 말하게 보여 주고, 말할 항목 목록은 접어 둔다. */
function DictationExample({
  program,
  profession,
  formIds,
  lines,
}: {
  program: Program;
  profession: Profession;
  formIds: readonly FormId[];
  lines: readonly VisitDictationExampleLine[];
}) {
  return (
    <div className="bg-muted/70 flex flex-col gap-3 rounded-xl p-4">
      <div>
        <p className="font-semibold">이렇게 말해 보세요</p>
        <p className="text-muted-foreground text-sm">
          {PROGRAM_LABELS[program]} {PROFESSION_LABELS[profession]} 방문
          예시입니다. 순서는 상관없고, 오늘 한 것만 말하면 됩니다.
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {lines.map((line) => (
          <li key={line.text} className="border-primary/40 border-l-4 pl-3">
            <p className="text-lg">{line.text}</p>
            <p className="text-muted-foreground text-sm">
              {line.fills.join(" · ")}
            </p>
          </li>
        ))}
      </ol>
      <details>
        <summary className="text-primary cursor-pointer font-semibold">
          말할 항목 모두 보기
        </summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
          {dictationGuide(formIds).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/**
 * 방문 직후 음성 구술 → 서식 초안. 기록 화면 맨 위에 둔다.
 * 한 번 말하면 이 방문의 서식 모두(재택의료 의사: 별지 제4·6호)를 함께 채운다.
 * 초안은 "서식에 채우기"를 눌러야 폼에 들어가고, 저장은 기존 [임시 저장]·[확정]이 한다.
 * 녹음 상태(session)는 기록 화면이 갖고 저장 버튼 바의 [녹음]과 함께 쓴다.
 */
export function DictationPanel({
  session,
  panelRef,
  visit,
  form,
}: {
  session: DictationSession;
  /** 저장 버튼 바에서 녹음한 뒤 알림의 [확인하기]가 올라올 자리 */
  panelRef: RefObject<HTMLElement | null>;
  visit: PanelVisit;
  form: RecordForm;
}) {
  const { dictation, recorder, failed, isBusy, redraft, removeDictation } =
    session;
  const { formIds } = visit;
  const [overwritten, setOverwritten] = useState<string[] | null>(null);
  const [restartOpen, setRestartOpen] = useState(false);
  const [appliedAt, setAppliedAt] = useState<string | null>(null);
  const startRecording = () => session.start("panel");

  const examples = dictationExample(
    visit.program,
    visit.profession,
    formIds,
    visit.recipient.name,
  );
  // 초안을 만든 뒤 방문에 더한 서식(초안에는 만들 때 쓴 서식마다 키가 있다). 초안 다시 만들기로 채운다.
  const addedAfterDraft = dictation
    ? formIds.filter((formId) => !(formId in dictation.draft))
    : [];

  const applyDraft = (force = false) => {
    if (!dictation) return;
    const merged = mergeDraft(
      form.getValues("forms"),
      dictation.draft,
      formIds,
    );
    if (merged.overwritten.length > 0 && !force) {
      setOverwritten(merged.overwritten);
      return;
    }
    form.setValue("forms", merged.forms, { shouldDirty: true });
    setOverwritten(null);
    setAppliedAt(dictation.updatedAt);
    toast.success(
      "초안을 서식에 채웠습니다. 내용을 확인하고 [임시 저장]을 눌러 주세요",
    );
  };

  const handleRestart = () => {
    removeDictation.mutate(undefined, {
      onSuccess: () => {
        setRestartOpen(false);
        setAppliedAt(null);
      },
      onError: (error) => {
        setRestartOpen(false);
        toast.error(getErrorMessage(error, "구술을 지우지 못했습니다"));
      },
    });
  };

  const handleRedraft = () => {
    redraft.mutate(undefined, {
      onError: (error) =>
        toast.error(getErrorMessage(error, "초안을 만들지 못했습니다")),
    });
  };

  // 초안 실패·서식 추가 안내에 함께 쓴다.
  const redraftButton = (
    <Button variant="outline" onClick={handleRedraft} disabled={isBusy}>
      {redraft.isPending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <RotateCw />
      )}
      초안 다시 만들기
    </Button>
  );

  /** 녹음 중·처리 중·보내기 실패 표시. 없으면 null(평소 버튼을 보여 준다). */
  const controls = (() => {
    if (session.isRecording) {
      return (
        <RecordingControls
          seconds={recorder.seconds}
          level={recorder.level}
          onStop={recorder.stop}
          onCancel={recorder.cancel}
        />
      );
    }
    if (session.isProcessing) return <Processing />;
    if (failed) {
      return (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive-soft flex flex-col gap-3 rounded-xl border p-4"
        >
          <p className="text-destructive font-semibold">{failed.message}</p>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={session.retry}>
              <RotateCw />
              다시 보내기
            </Button>
            <Button variant="outline" onClick={session.discardFailed}>
              녹음 버리기
            </Button>
          </div>
        </div>
      );
    }
    return null;
  })();

  if (session.isLoading) return null;

  // 빠진 항목은 기록에 이미 있는 값(저장한 값, 없으면 이월 값)을 빼고 센다.
  const record: VisitForms = Object.fromEntries(
    formIds.map((formId) => [formId, formStartValues(visit, formId)]),
  );

  return (
    <Card ref={panelRef} className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="text-primary size-5" />
          음성으로 기록
        </CardTitle>
        {!dictation && (
          <CardDescription className="text-base">
            방문을 마친 뒤 2~3분 동안 편하게 말하면 서식 초안을 만들어 드립니다.
            초안은 확인한 뒤 서식에 채웁니다.
          </CardDescription>
        )}
      </CardHeader>

      {recorder.error && (
        <p
          role="alert"
          className="text-destructive flex items-start gap-2 font-semibold"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          {recorder.error}
        </p>
      )}

      {!dictation && (
        <>
          {/* 녹음을 누른 뒤 아래 예시를 보며 말하도록 조작을 예시 위에 둔다. */}
          {controls ?? (
            <Button
              size="lg"
              className="w-full"
              onClick={startRecording}
              disabled={isBusy}
            >
              <Mic />
              녹음 시작
            </Button>
          )}
          <DictationExample
            program={visit.program}
            profession={visit.profession}
            formIds={formIds}
            lines={examples}
          />
        </>
      )}

      {dictation && (
        <>
          {dictation.draftError ? (
            <div
              role="alert"
              className="border-warning/20 bg-warning-soft flex flex-col gap-3 rounded-xl border p-4"
            >
              <p className="text-warning flex items-start gap-2 font-semibold">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                {dictation.draftError}
              </p>
              {redraftButton}
            </div>
          ) : (
            addedAfterDraft.length > 0 && (
              <div
                role="status"
                className="border-primary/20 bg-primary-soft/60 flex flex-col gap-3 rounded-xl border p-4"
              >
                <p className="text-primary font-semibold">
                  초안을 만든 뒤{" "}
                  {withParticle(
                    addedAfterDraft.map(formLabel).join(", "),
                    "을/를",
                  )}{" "}
                  더했습니다. 초안을 다시 만들면 더한 서식도 채웁니다.
                </p>
                {redraftButton}
              </div>
            )
          )}

          <DraftReview dictation={dictation} formIds={formIds} />
          <MissingItems
            items={missingDictationItems(dictation, formIds, record)}
            examples={examples}
            disabled={isBusy}
            onAnswer={startRecording}
          />
          <TranscriptDetails dictation={dictation} />

          <div className="flex flex-col gap-3">
            {controls ?? (
              <>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => applyDraft()}
                  disabled={isBusy}
                >
                  <ClipboardCheck />
                  서식에 채우기
                </Button>
                {appliedAt === dictation.updatedAt && (
                  <p className="text-success text-center font-semibold">
                    서식에 채웠습니다. 아래 서식을 확인하고 저장해 주세요.
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={startRecording}
                    disabled={isBusy}
                  >
                    <Mic />
                    이어서 말하기
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setRestartOpen(true)}
                    disabled={isBusy}
                  >
                    <RotateCcw />
                    처음부터
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={overwritten !== null}
        onOpenChange={(open) => {
          if (!open) setOverwritten(null);
        }}
        onConfirm={() => applyDraft(true)}
        title="입력한 값을 초안으로 바꿀까요?"
        description={`이미 입력한 ${overwritten?.join(", ") ?? ""} 값을 초안 내용으로 바꿉니다.`}
        confirmText="바꾸기"
      />
      <ConfirmDialog
        open={restartOpen}
        onOpenChange={setRestartOpen}
        onConfirm={handleRestart}
        isPending={removeDictation.isPending}
        title="구술을 지우고 처음부터 녹음할까요?"
        description="지금까지 녹음한 구술과 초안이 지워집니다. 서식에 이미 채운 내용은 그대로 남습니다."
        confirmText="지우기"
        variant="destructive"
      />
    </Card>
  );
}
