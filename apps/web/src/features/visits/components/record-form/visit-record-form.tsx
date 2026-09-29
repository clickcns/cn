import { useState } from "react";
import { getErrorMessage } from "@repo/api-client";
import {
  FORMS,
  hasOptionalForms,
  type FormId,
  type VisitDetail,
} from "@repo/shared-types";
import { Files } from "lucide-react";
import { useForm, useFormState } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DictationPanel } from "@/features/dictation/components/dictation-panel";
import { FormFields } from "@/features/forms/components/form-fields";
import { FormHeading } from "@/features/forms/components/form-view";
import { FormTabs } from "@/features/forms/components/form-tabs";
import { FormSelectDialog } from "@/features/visits/components/record-form/form-select-dialog";
import { RecordActionBar } from "@/features/visits/components/record-form/record-action-bar";
import { UnsavedChangesDialog } from "@/features/visits/components/record-form/unsaved-changes-dialog";
import { VisitTimeSection } from "@/features/visits/components/record-form/visit-time-section";
import {
  useConfirmVisit,
  useSaveVisitRecord,
  useUpdateVisitForms,
} from "@/features/visits/hooks/use-visit-mutations";
import { useUnsavedChangesGuard } from "@/features/visits/hooks/use-unsaved-changes-guard";
import {
  buildSaveInput,
  toFormInitialState,
  toRecordFormValues,
} from "@/features/visits/lib/record-form";

/**
 * 방문 기록 작성 폼: 방문 시각 + 이 방문의 서식들(사업·담당자 직종의 규칙 안에서 고른 것).
 * 서식이 여럿이면(재택의료 의사: 별지 제4·6호) 탭으로 나누고 저장·확정은 함께 한다.
 * 선택 서식이 있으면 확정 전까지 [서식 바꾸기]로 켜고 끈다.
 * 방문이 바뀌면 key로 다시 마운트해 초기값을 새로 잡는다
 * (서버 응답으로 캐시가 갱신돼도 입력 중인 값은 건드리지 않는다).
 */
export function VisitRecordForm({ visit }: { visit: VisitDetail }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState(visit.formIds[0]);
  // 보고 있던 서식을 뺐으면 첫 서식을 보여 준다.
  const activeFormId =
    selectedFormId && visit.formIds.includes(selectedFormId)
      ? selectedFormId
      : visit.formIds[0];

  const {
    control,
    register,
    setValue,
    getValues,
    getFieldState,
    reset,
    resetField,
  } = useForm({ defaultValues: toRecordFormValues(visit) });
  const { isDirty } = useFormState({ control });

  const saveRecord = useSaveVisitRecord(visit.id);
  const confirmVisit = useConfirmVisit(visit.id);
  const updateForms = useUpdateVisitForms(visit.id);
  const isPending =
    saveRecord.isPending || confirmVisit.isPending || updateForms.isPending;
  const canChangeForms = hasOptionalForms(visit.program, visit.profession);

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

  /**
   * 서식 바꾸기. 더한 서식은 서버가 준 이월 값으로 채워 "저장 안 됨"으로 표시한다(확정 전에 저장해야 한다).
   * 뺀 서식은 서버가 저장 값을 지우고, 폼에서는 기본값으로 되돌려 저장 요청·"저장 안 됨"에서 빠진다.
   */
  const handleChangeForms = (formIds: FormId[]) => {
    updateForms.mutate(
      { formIds },
      {
        onSuccess: (updated) => {
          const added = updated.formIds.filter(
            (formId) => !visit.formIds.includes(formId),
          );
          for (const formId of added) {
            setValue(`forms.${formId}`, toFormInitialState(updated, formId), {
              shouldDirty: true,
            });
          }
          for (const formId of visit.formIds) {
            if (!updated.formIds.includes(formId)) {
              resetField(`forms.${formId}`);
            }
          }
          if (added[0]) setSelectedFormId(added[0]);
          setFormsOpen(false);
          toast.success(
            added.length > 0
              ? "서식을 더했습니다. 내용을 채우고 [임시 저장]을 눌러 주세요"
              : "서식을 뺐습니다",
          );
        },
        onError: (error) =>
          toast.error(getErrorMessage(error, "서식을 바꾸지 못했습니다")),
      },
    );
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
    // 모든 서식이 저장돼 있어야 확정할 수 있으므로, 바뀐 게 없어도 저장하지 않은 서식이 있으면
    // (처음 작성하거나 나중에 더한 서식) 먼저 저장한다.
    const needsSave =
      isDirty || visit.formIds.some((formId) => !(formId in visit.forms));
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

        {canChangeForms && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              작성 서식 {visit.formIds.length}개
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormsOpen(true)}
              disabled={isPending}
            >
              <Files />
              서식 바꾸기
            </Button>
          </div>
        )}
        {visit.formIds.length > 1 && (
          <FormTabs
            formIds={visit.formIds}
            value={activeFormId}
            onChange={setSelectedFormId}
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
            ? `서식 ${visit.formIds.length}개를 함께 확정합니다. 확정하면 읽기 전용이 되고, 고칠 때는 [수정]을 누릅니다.`
            : "확정하면 읽기 전용이 되고, 고칠 때는 [수정]을 누릅니다."
        }
        confirmText="확정"
      />
      <FormSelectDialog
        open={formsOpen}
        onOpenChange={setFormsOpen}
        visit={visit}
        hasContent={(formId) =>
          formId in visit.forms || getFieldState(`forms.${formId}`).isDirty
        }
        onSubmit={handleChangeForms}
        isPending={updateForms.isPending}
      />
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
