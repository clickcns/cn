import { useState, type RefObject } from "react";
import { getErrorMessage } from "@repo/api-client";
import {
  filledDraftFields,
  filledItemCount,
  formLabel,
  missingDictationItems,
  withParticle,
  type VisitDetail,
  type VisitDictation,
  type VisitForms,
} from "@repo/shared-types";
import {
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  LoaderCircle,
  Mic,
  RotateCcw,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import {
  DraftReview,
  TranscriptDetails,
} from "@/features/dictation/components/draft-review";
import { MissingItems } from "@/features/dictation/components/missing-items";
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

type PanelVisit = Pick<VisitDetail, "formIds" | "forms" | "carryOver">;

/** 녹음 길이(초) → "2분 15초" */
const formatDuration = (seconds: number) => {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest}초`;
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
};

/** 초안 한눈에: 채운 항목 수와 빠진 필수 항목 수. */
function DraftSummary({
  filled,
  requiredMissing,
}: {
  filled: number;
  requiredMissing: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={filled > 0 ? "success" : "neutral"}>
        <CircleCheck />
        {filled > 0 ? `${filled}개 항목 채움` : "채운 항목 없음"}
      </Badge>
      {requiredMissing > 0 && (
        <Badge variant="warning">
          <CircleAlert />
          필수 {requiredMissing}개 빠짐
        </Badge>
      )}
    </div>
  );
}

/**
 * 초안 요약·채운 값·빠진 항목. 녹음하는 동안 패널은 입력 크기가 바뀔 때마다 다시 그려지므로,
 * 구술·방문이 그대로면 다시 계산하지 않게 따로 둔다.
 */
function DraftBody({
  dictation,
  visit,
}: {
  dictation: VisitDictation;
  visit: PanelVisit;
}) {
  const { formIds } = visit;
  const filled = filledDraftFields(dictation, formIds);
  // 빠진 항목은 기록에 이미 있는 값(저장한 값, 없으면 이월 값)을 빼고 센다.
  const record: VisitForms = Object.fromEntries(
    formIds.map((formId) => [formId, formStartValues(visit, formId)]),
  );
  const missing = missingDictationItems(dictation, formIds, record);

  return (
    <>
      {!dictation.draftError && (
        <DraftSummary
          filled={filledItemCount(filled)}
          requiredMissing={missing.filter((item) => item.required).length}
        />
      )}
      <DraftReview
        dictation={dictation}
        filled={filled}
        showTitles={formIds.length > 1}
      />
      <MissingItems items={missing} />
    </>
  );
}

/**
 * 음성 구술 초안 카드. 구술이 생기면 기록 화면 맨 위에 나타난다(그 전에는 서식만 보인다).
 * 한 번 말하면 이 방문의 서식 모두(재택의료 의사: 별지 제4·6호)를 함께 채운다.
 * 초안은 "서식에 채우기"를 눌러야 폼에 들어가고, 저장은 기존 [임시 저장]·[확정]이 한다.
 * 녹음 상태(session)는 기록 화면이 갖는다. 녹음 조작·말할 내용·처리 중·보내기 실패는 저장 버튼 바와
 * 그 위 시트(DictationSheet)가 보여 주고, 이 카드의 [이어서 말하기]도 같은 녹음을 시작한다.
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
  const { dictation, isBusy, redraft, removeDictation } = session;
  const { formIds } = visit;
  const [overwritten, setOverwritten] = useState<string[] | null>(null);
  const [restartOpen, setRestartOpen] = useState(false);
  const [appliedAt, setAppliedAt] = useState<string | null>(null);
  if (!dictation) return null;

  // 초안을 만든 뒤 방문에 더한 서식(초안에는 만들 때 쓴 서식마다 키가 있다). 초안 다시 만들기로 채운다.
  const addedAfterDraft = formIds.filter(
    (formId) => !(formId in dictation.draft),
  );

  const applyDraft = (force = false) => {
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

  return (
    <Card ref={panelRef} className="scroll-mt-20 gap-5">
      <div className="flex items-center gap-3">
        <span className="bg-primary-soft text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
          <Mic className="size-5" />
        </span>
        <CardHeader className="min-w-0 gap-0">
          <CardTitle>음성 초안</CardTitle>
          <CardDescription>
            녹음 {dictation.takes}회 · {formatDuration(dictation.audioSeconds)}
          </CardDescription>
        </CardHeader>
      </div>

      {dictation.draftError ? (
        <Notice
          tone="warning"
          icon={TriangleAlert}
          message={dictation.draftError}
        >
          {redraftButton}
        </Notice>
      ) : (
        addedAfterDraft.length > 0 && (
          <Notice
            tone="primary"
            icon={RotateCw}
            message={`초안을 만든 뒤 ${withParticle(
              addedAfterDraft.map(formLabel).join(", "),
              "을/를",
            )} 더했습니다. 초안을 다시 만들면 더한 서식도 채웁니다.`}
          >
            {redraftButton}
          </Notice>
        )
      )}

      <DraftBody dictation={dictation} visit={visit} />

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
          <p className="text-success flex items-center justify-center gap-2 font-semibold">
            <CircleCheck className="size-5 shrink-0" />
            서식에 채웠습니다. 아래 서식을 확인하고 저장해 주세요.
          </p>
        )}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => session.start("panel")}
            disabled={!session.canStart}
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

      <TranscriptDetails dictation={dictation} />

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
