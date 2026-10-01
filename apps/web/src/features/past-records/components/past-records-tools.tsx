import { useId, useRef, useState } from "react";
import {
  FORMS,
  formFields,
  isEmptyValue,
  reusableFieldValue,
  withParticle,
  type FormData,
  type FormId,
  type PastFieldValues,
} from "@repo/shared-types";
import { CopyCheck, History, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fieldElementId } from "@/features/forms/lib/field-ids";
import {
  sameFieldState,
  toFieldState,
  type FieldState,
} from "@/features/forms/lib/form-state";
import { mergeFormValues } from "@/features/forms/lib/merge-form-values";
import type { PastFills } from "@/features/forms/lib/past-fill";
import {
  PastRecordDialog,
  type PastApplyRequest,
} from "@/features/past-records/components/past-record-dialog";
import { usePastRecordParam } from "@/features/past-records/hooks/use-past-record-param";
import {
  usePastRecords,
  type PastRecordsAnchor,
} from "@/features/past-records/hooks/use-past-records";
import type { RecordForm } from "@/features/visits/lib/record-form";

/** 이월 칸(수급자 상태처럼 자주 바뀌지 않는 칸) 가운데 지난 값이 있는 칸. */
function carryOverTargets(
  formIds: readonly FormId[],
  pastValues: Partial<Record<FormId, PastFieldValues>> | undefined,
) {
  return formIds.flatMap((formId) =>
    formFields(FORMS[formId]).flatMap((field) => {
      const past = pastValues?.[formId]?.[field.key];
      const value = past && reusableFieldValue(field, past.value);
      return field.carryOver && past && value
        ? [{ formId, key: field.key, value, date: past.date }]
        : [];
    }),
  );
}

/** 지난 기록으로 채운 칸 하나와 채운 값. */
interface FilledField {
  formId: FormId;
  key: string;
  state: FieldState;
}

/**
 * 기록 화면의 지난 기록 도구(지난 기록이 있을 때만): [지난 기록 보기]·[이월 칸 채우기]·"칸마다 지난 값"
 * 스위치와 기록 보기 창. 지난 기록 값은 사용자가 누를 때만 채운다(저절로 채우지 않는다).
 * - 이월 칸 채우기: 비어 있는 이월 칸을 칸마다 가장 최근 값으로. 채운 뒤에는 [이월 취소]가 되어, 채운 값
 *   그대로인 칸을 다시 비운다(그사이 고친 칸은 그대로)
 * - 보기 창: 고른 서식·구분 값으로(여러 개 고르는 칸은 그 기록대로 바꾼다). 이미 입력한 값이 바뀌면 먼저 묻는다
 * 채운 칸은 onFilled 로 알려 "지난 기록" 표시를 달게 하고, 알림에 [되돌리기]를 준다.
 */
export function PastRecordsTools({
  visit,
  activeFormId,
  onShowForm,
  form,
  pastValues,
  onFilled,
  showPast,
  onToggleShowPast,
}: {
  visit: PastRecordsAnchor;
  activeFormId: FormId | undefined;
  onShowForm: (formId: FormId) => void;
  form: RecordForm;
  /** 서식·칸마다 지난 값(usePastFieldValues) */
  pastValues: Partial<Record<FormId, PastFieldValues>> | undefined;
  onFilled: (formId: FormId, entries: PastFills) => void;
  showPast: boolean;
  onToggleShowPast: () => void;
}) {
  const records = usePastRecords(visit).data ?? [];
  const { open, close } = usePastRecordParam();
  const [pending, setPending] = useState<{
    request: PastApplyRequest;
    overwritten: string[];
  } | null>(null);
  // 창을 닫은 뒤 포커스를 옮길 칸(채운 첫 칸). 이벤트 처리에서만 읽고 쓴다.
  const focusAfterCloseRef = useRef<string | null>(null);
  const switchId = useId();
  // [이월 칸 채우기]로 채운 칸. 있으면 버튼이 [이월 취소]가 된다.
  const [carried, setCarried] = useState<FilledField[] | null>(null);

  /**
   * 값을 채우고 표시를 달며 알림에 [되돌리기]를 준다(undo 가 없으면 채우기 전 서식으로 되돌린다).
   * 바뀐 칸이 없으면 false.
   */
  const fill = (
    incoming: Partial<Record<FormId, FormData>>,
    dates: (formId: FormId, key: string) => string,
    message: string,
    undo?: (filled: FilledField[]) => void,
  ): FilledField[] | false => {
    const formIds = Object.keys(incoming) as FormId[];
    const before = form.getValues("forms");
    const merged = mergeFormValues(before, incoming, formIds, {
      multi: "replace",
    });
    if (merged.changed.length === 0) return false;
    const filled = merged.changed.map(({ formId, key }) => ({
      formId,
      key,
      state: merged.forms[formId]![key]!,
    }));
    const changedForms = [...new Set(merged.changed.map((c) => c.formId))];
    for (const formId of changedForms) {
      form.setValue(`forms.${formId}`, merged.forms[formId]!, {
        shouldDirty: true,
      });
      onFilled(
        formId,
        Object.fromEntries(
          filled
            .filter((c) => c.formId === formId)
            .map(({ key, state }) => [
              key,
              { state, date: dates(formId, key) },
            ]),
        ),
      );
    }
    toast.success(message, {
      action: {
        label: "되돌리기",
        onClick: () => {
          if (undo) {
            undo(filled);
            return;
          }
          for (const formId of changedForms) {
            const previous = before[formId];
            if (previous) {
              form.setValue(`forms.${formId}`, previous, { shouldDirty: true });
            }
          }
        },
      },
    });
    return filled;
  };

  const apply = (request: PastApplyRequest, force = false) => {
    if (!force) {
      const preview = mergeFormValues(
        form.getValues("forms"),
        { [request.formId]: request.values },
        [request.formId],
        { multi: "replace" },
      );
      if (preview.overwritten.length > 0) {
        setPending({ request, overwritten: preview.overwritten });
        return;
      }
    }
    const changed = fill(
      { [request.formId]: request.values },
      () => request.date,
      `${withParticle(request.source, "을/를")} 채웠습니다. 확인하고 [임시 저장]을 눌러 주세요`,
    );
    setPending(null);
    if (!changed) {
      toast.info("이미 같은 값이라 바뀐 칸이 없습니다");
      return;
    }
    onShowForm(request.formId);
    focusAfterCloseRef.current = fieldElementId(
      `forms.${request.formId}`,
      changed[0]!.key,
    );
    close();
  };

  const targets = carryOverTargets(visit.formIds, pastValues);

  /** 이월로 채운 칸 가운데 채운 값 그대로인 칸을 다시 비운다(그사이 고친 칸은 그대로 둔다). */
  const cancelCarryOver = (filled: FilledField[] | null = carried) => {
    let cleared = 0;
    for (const { formId, key, state } of filled ?? []) {
      const path = `forms.${formId}.${key}` as const;
      if (!sameFieldState(form.getValues(path), state)) continue;
      const field = formFields(FORMS[formId]).find((f) => f.key === key)!;
      form.setValue(path, toFieldState(field, undefined), {
        shouldDirty: true,
      });
      cleared += 1;
    }
    setCarried(null);
    if (cleared > 0) toast.info(`이월한 칸 ${cleared}개를 다시 비웠습니다`);
    else toast.info("되돌릴 이월 칸이 없습니다(이미 고친 칸은 그대로 둡니다)");
  };

  /** 비어 있는 이월 칸을 칸마다 가장 최근 값으로 채운다(이미 입력한 칸은 그대로). */
  const fillCarryOver = () => {
    const current = form.getValues("forms");
    const incoming: Partial<Record<FormId, FormData>> = {};
    for (const target of targets) {
      if (!isEmptyValue(current[target.formId]?.[target.key])) continue;
      incoming[target.formId] = {
        ...incoming[target.formId],
        [target.key]: target.value,
      };
    }
    const filled = fill(
      incoming,
      (formId, key) =>
        targets.find((t) => t.formId === formId && t.key === key)!.date,
      "지난 기록에서 이월 칸을 채웠습니다. 확인하고 [임시 저장]을 눌러 주세요",
      cancelCarryOver,
    );
    if (filled) setCarried(filled);
    else toast.info("비어 있는 이월 칸이 없습니다");
  };

  // 지금 보고 있는 서식이 있는 가장 최근 기록부터 연다.
  const latest =
    records.find(
      (record) => activeFormId && record.formIds.includes(activeFormId),
    ) ?? records[0];

  return (
    <>
      {latest && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => open(latest.id)}>
              <History />
              지난 기록 보기
            </Button>
            {carried ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelCarryOver()}
              >
                <Undo2 />
                이월 취소
              </Button>
            ) : (
              targets.length > 0 && (
                <Button variant="soft" size="sm" onClick={fillCarryOver}>
                  <CopyCheck />
                  이월 칸 채우기
                </Button>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={switchId} className="text-muted-foreground">
              칸마다 지난 값
            </Label>
            <Switch
              id={switchId}
              checked={showPast}
              onCheckedChange={onToggleShowPast}
            />
          </div>
        </div>
      )}
      <PastRecordDialog
        visit={visit}
        preferredFormId={activeFormId}
        onApply={apply}
        onCloseAutoFocus={(event) => {
          const target = focusAfterCloseRef.current;
          if (!target) return;
          focusAfterCloseRef.current = null;
          event.preventDefault();
          // 서식 탭이 바뀐 뒤에 찾는다.
          requestAnimationFrame(() => {
            const element = document.getElementById(target);
            element?.scrollIntoView({ behavior: "smooth", block: "center" });
            element?.focus({ preventScroll: true });
          });
        }}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPending(null);
        }}
        onConfirm={() => pending && apply(pending.request, true)}
        title="입력한 값을 바꿀까요?"
        description={
          pending
            ? `이미 입력한 ${pending.overwritten.join(", ")} 값을 ${pending.request.source} 값으로 바꿉니다.`
            : undefined
        }
        confirmText="바꾸기"
      />
    </>
  );
}
