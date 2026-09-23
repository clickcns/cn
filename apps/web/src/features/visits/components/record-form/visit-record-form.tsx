import { useState } from "react";
import { getErrorMessage } from "@repo/api-client";
import { FORMS, type VisitDetail } from "@repo/shared-types";
import { useForm, useFormState } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DictationPanel } from "@/features/dictation/components/dictation-panel";
import { FormFields } from "@/features/forms/components/form-fields";
import { FormHeading } from "@/features/forms/components/form-view";
import { FormTabs } from "@/features/forms/components/form-tabs";
import { RecordActionBar } from "@/features/visits/components/record-form/record-action-bar";
import { UnsavedChangesDialog } from "@/features/visits/components/record-form/unsaved-changes-dialog";
import { VisitTimeSection } from "@/features/visits/components/record-form/visit-time-section";
import {
  useConfirmVisit,
  useSaveVisitRecord,
} from "@/features/visits/hooks/use-visit-mutations";
import { useUnsavedChangesGuard } from "@/features/visits/hooks/use-unsaved-changes-guard";
import {
  buildSaveInput,
  toRecordFormValues,
} from "@/features/visits/lib/record-form";

/**
 * 방문 기록 작성 폼: 방문 시각 + 이 방문의 서식들(사업·담당자 직종으로 정해짐).
 * 서식이 여럿이면(재택의료 의사: 별지 제4·6호) 탭으로 나누고 저장·확정은 함께 한다.
 * 방문이 바뀌면 key로 다시 마운트해 초기값을 새로 잡는다
 * (서버 응답으로 캐시가 갱신돼도 입력 중인 값은 건드리지 않는다).
 */
export function VisitRecordForm({ visit }: { visit: VisitDetail }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeFormId, setActiveFormId] = useState(visit.formIds[0]);

  const { control, register, setValue, getValues, reset } = useForm({
    defaultValues: toRecordFormValues(visit),
  });
  const { isDirty } = useFormState({ control });

  const saveRecord = useSaveVisitRecord(visit.id);
  const confirmVisit = useConfirmVisit(visit.id);
  const isPending = saveRecord.isPending || confirmVisit.isPending;

  const blocker = useUnsavedChangesGuard(isDirty);

  /**
   * 검사 후 저장하고, 저장한 값을 "변경 없음"의 기준으로 삼는다.
   * 입력값에 문제가 있으면 오류를 토스트로 알리고 false를 돌려준다.
   */
  const save = async (): Promise<boolean> => {
    const values = getValues();
    const result = buildSaveInput(values, visit.formIds);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    await saveRecord.mutateAsync(result.input);
    // 저장 요청 중에 더 입력한 내용은 지우지 않는다.
    reset(values, { keepValues: true });
    return true;
  };

  const handleSave = async () => {
    if (isPending) return;
    try {
      if (await save()) toast.success("임시 저장했습니다");
    } catch (error) {
      toast.error(getErrorMessage(error, "저장하지 못했습니다"));
    }
  };

  const handleConfirmClick = () => {
    // 확인 창을 띄우기 전에 입력값부터 검사한다.
    const result = buildSaveInput(getValues(), visit.formIds);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    // 모든 서식이 저장돼 있어야 확정할 수 있으므로, 바뀐 게 없어도 처음이면 저장한다.
    const needsSave = isDirty || visit.status !== "DRAFT";
    try {
      if (needsSave && !(await save())) {
        setConfirmOpen(false);
        return;
      }
      await confirmVisit.mutateAsync();
      // 확정되면 상세 캐시가 갱신되어 읽기 전용 화면으로 바뀐다.
      toast.success("방문 기록을 확정했습니다");
    } catch (error) {
      setConfirmOpen(false);
      toast.error(getErrorMessage(error, "확정하지 못했습니다"));
    }
  };

  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <DictationPanel
          visitId={visit.id}
          formIds={visit.formIds}
          form={{ getValues, setValue }}
        />
        <VisitTimeSection
          control={control}
          register={register}
          setValue={setValue}
        />

        {visit.formIds.length > 1 && (
          <FormTabs
            formIds={visit.formIds}
            value={activeFormId}
            onChange={setActiveFormId}
          />
        )}
        {visit.formIds.map((formId) => (
          <section
            key={formId}
            id={`form-panel-${formId}`}
            role={visit.formIds.length > 1 ? "tabpanel" : undefined}
            hidden={formId !== activeFormId}
            className="flex flex-col gap-4"
          >
            <FormHeading form={FORMS[formId]} />
            <FormFields
              form={FORMS[formId]}
              control={control}
              basePath={`forms.${formId}`}
            />
          </section>
        ))}

        <RecordActionBar
          isDirty={isDirty}
          isPending={isPending}
          onSave={() => void handleSave()}
          onConfirm={handleConfirmClick}
        />
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void handleConfirm()}
        isPending={isPending}
        title="방문 기록을 확정할까요?"
        description={
          visit.formIds.length > 1
            ? `서식 ${visit.formIds.length}개를 함께 확정합니다. 확정하면 더 이상 수정할 수 없습니다.`
            : "확정하면 더 이상 수정할 수 없습니다."
        }
        confirmText="확정"
      />
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
