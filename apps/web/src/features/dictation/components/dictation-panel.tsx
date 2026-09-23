import { useState } from "react";
import { getErrorMessage } from "@repo/api-client";
import {
  DICTATION_MAX_SECONDS,
  FORMS,
  type FormId,
  type VisitDictation,
} from "@repo/shared-types";
import {
  ClipboardCheck,
  LoaderCircle,
  MessageCircleQuestion,
  Mic,
  RotateCcw,
  RotateCw,
  Square,
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
import {
  RecordingDecodeError,
  useDictation,
  useRecordDictation,
  useRedraftDictation,
  useRemoveDictation,
} from "@/features/dictation/hooks/use-dictation";
import { useRecorder } from "@/features/dictation/hooks/use-recorder";
import { mergeDraft } from "@/features/dictation/lib/merge-draft";
import type { RecordFormValues } from "@/features/visits/lib/record-form";

type RecordForm = Pick<
  UseFormReturn<RecordFormValues>,
  "getValues" | "setValue"
>;

const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function uploadErrorMessage(error: unknown): string {
  return error instanceof RecordingDecodeError
    ? error.message
    : getErrorMessage(error, "녹음을 보내지 못했습니다");
}

/** 녹음 중 표시: 경과 시간, 입력 크기, 끝내기·취소. */
function RecordingControls({
  seconds,
  level,
  onStop,
  onCancel,
}: {
  seconds: number;
  level: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border-destructive/30 bg-destructive-soft flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center gap-3" aria-live="polite">
        <span className="bg-destructive size-3 shrink-0 animate-pulse rounded-full" />
        <span className="text-destructive font-bold">녹음 중</span>
        <span className="ml-auto text-2xl font-bold tabular-nums">
          {formatClock(seconds)}
          <span className="text-muted-foreground text-base font-normal">
            {" "}
            / {formatClock(DICTATION_MAX_SECONDS)}
          </span>
        </span>
      </div>
      {/* 입력 크기: 말할 때 막대가 움직이면 마이크가 소리를 받고 있다. */}
      <div className="bg-card h-2.5 overflow-hidden rounded-full" aria-hidden>
        <div
          className="bg-destructive h-full rounded-full transition-[width] duration-100"
          style={{ width: `${Math.round(level * 100)}%` }}
        />
      </div>
      <div className="flex gap-3">
        <Button size="lg" className="flex-1" onClick={onStop}>
          <Square />
          녹음 끝내기
        </Button>
        <Button size="lg" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}

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

/** 빠진 항목 되묻기. 음성으로 답하면 이전 구술에 이어 붙어 초안이 다시 만들어진다. */
function FollowUpQuestions({
  dictation,
  disabled,
  onAnswer,
}: {
  dictation: VisitDictation;
  disabled: boolean;
  onAnswer: () => void;
}) {
  if (dictation.questions.length === 0) return null;
  return (
    <div className="border-primary/20 bg-primary-soft/60 flex flex-col gap-3 rounded-xl border p-4">
      <p className="text-primary flex items-center gap-2 font-bold">
        <MessageCircleQuestion className="size-5 shrink-0" />
        빠진 항목이 있어요
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-6 text-lg">
        {dictation.questions.map((question) => (
          <li key={question.question}>{question.question}</li>
        ))}
      </ul>
      <Button variant="soft" onClick={onAnswer} disabled={disabled}>
        <Mic />
        음성으로 답하기
      </Button>
      <p className="text-muted-foreground text-sm">
        말하기 어려우면 서식에 채운 뒤 직접 입력해도 됩니다.
      </p>
    </div>
  );
}

/**
 * 방문 직후 음성 구술 → 서식 초안. 기록 화면 맨 위에 둔다.
 * 한 번 말하면 이 방문의 서식 모두(재택의료 의사: 별지 제4·6호)를 함께 채운다.
 * 초안은 "서식에 채우기"를 눌러야 폼에 들어가고, 저장은 기존 [임시 저장]·[확정]이 한다.
 */
export function DictationPanel({
  visitId,
  formIds,
  form,
}: {
  visitId: string;
  formIds: readonly FormId[];
  form: RecordForm;
}) {
  const dictationQuery = useDictation(visitId);
  const dictation = dictationQuery.data ?? null;
  const recordDictation = useRecordDictation(visitId);
  const redraft = useRedraftDictation(visitId);
  const removeDictation = useRemoveDictation(visitId);

  /** 보내지 못한 녹음. 다시 녹음하지 않고 그대로 다시 보낼 수 있게 남겨 둔다. */
  const [failed, setFailed] = useState<{
    recording: Blob;
    append: boolean;
    message: string;
  } | null>(null);
  const [overwritten, setOverwritten] = useState<string[] | null>(null);
  const [restartOpen, setRestartOpen] = useState(false);
  const [appliedAt, setAppliedAt] = useState<string | null>(null);

  const submit = (recording: Blob, append: boolean) => {
    setFailed(null);
    recordDictation.mutate(
      { recording, append },
      {
        onError: (error) =>
          setFailed({ recording, append, message: uploadErrorMessage(error) }),
      },
    );
  };

  const recorder = useRecorder({
    maxSeconds: DICTATION_MAX_SECONDS,
    // 구술이 이미 있으면 이어 붙인다(되묻기 답·추가 설명).
    onRecorded: (recording) => submit(recording, dictation !== null),
  });

  const isRecording = recorder.status !== "idle";
  const isBusy =
    isRecording ||
    recordDictation.isPending ||
    redraft.isPending ||
    removeDictation.isPending;

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

  const controls = (() => {
    if (isRecording) {
      return (
        <RecordingControls
          seconds={recorder.seconds}
          level={recorder.level}
          onStop={recorder.stop}
          onCancel={recorder.cancel}
        />
      );
    }
    if (recordDictation.isPending) return <Processing />;
    if (failed) {
      return (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive-soft flex flex-col gap-3 rounded-xl border p-4"
        >
          <p className="text-destructive font-semibold">{failed.message}</p>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => submit(failed.recording, failed.append)}
            >
              <RotateCw />
              다시 보내기
            </Button>
            <Button variant="outline" onClick={() => setFailed(null)}>
              녹음 버리기
            </Button>
          </div>
        </div>
      );
    }
    return null;
  })();

  if (dictationQuery.isPending) return null;

  return (
    <Card>
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
          <div className="bg-muted/70 rounded-xl p-4">
            <p className="mb-2 font-semibold">
              이런 내용을 말해 주세요 (순서는 상관없어요)
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-6">
              {dictationGuide(formIds).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {controls ?? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => void recorder.start()}
              disabled={isBusy}
            >
              <Mic />
              녹음 시작
            </Button>
          )}
        </>
      )}

      {dictation && (
        <>
          {dictation.draftError && (
            <div
              role="alert"
              className="border-warning/20 bg-warning-soft flex flex-col gap-3 rounded-xl border p-4"
            >
              <p className="text-warning flex items-start gap-2 font-semibold">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                {dictation.draftError}
              </p>
              <Button
                variant="outline"
                onClick={handleRedraft}
                disabled={isBusy}
              >
                {redraft.isPending ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <RotateCw />
                )}
                초안 다시 만들기
              </Button>
            </div>
          )}

          <DraftReview dictation={dictation} formIds={formIds} />
          <FollowUpQuestions
            dictation={dictation}
            disabled={isBusy}
            onAnswer={() => void recorder.start()}
          />
          <TranscriptDetails dictation={dictation} />

          {controls}

          {!controls && (
            <div className="flex flex-col gap-3">
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
                  onClick={() => void recorder.start()}
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
            </div>
          )}
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
