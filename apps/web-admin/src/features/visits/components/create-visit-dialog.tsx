import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  canHandleProgram,
  CARE_GRADE_LABELS,
  CreateVisitSchema,
  formatKstDate,
  formLabel,
  formRulesFor,
  HHMM_REGEX,
  PROGRAM_LABELS,
  PROGRAMS,
  resolveFormIds,
  toKstIsoDateTime,
  type FormChoices,
  type Program,
  type Recipient,
  type UserSummary,
} from "@repo/shared-types";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { FormField } from "@/components/ui/form-field";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  useOrganizationColumnNames,
  useScopeOrganizationId,
} from "@/features/organizations/hooks/use-organization-scope";
import { useRecipients } from "@/features/recipients/hooks/use-recipients";
import { useVisitStaff } from "@/features/users/hooks/use-users";
import { staffLabel } from "@/features/users/lib/staff-label";
import { useCreateVisit } from "@/features/visits/hooks/use-visits";

/** 날짜·시각을 따로 받아 제출할 때 한국 시간 ISO 문자열로 합친다. */
const CreateVisitFormSchema = z.object({
  recipientId: CreateVisitSchema.shape.recipientId,
  // 선택 전에는 ""이다. 고르지 않으면 스키마가 막는다.
  program: z.string().pipe(z.enum(PROGRAMS, "사업을 선택해 주세요")),
  // 관리자가 등록할 때는 담당자가 필수다.
  staffId: z.uuid("담당자를 선택해 주세요"),
  date: z.iso.date("방문 날짜를 선택해 주세요"),
  time: z.string().regex(HHMM_REGEX, "방문 시각을 입력해 주세요"),
});

interface CreateVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVisitDialog({
  open,
  onOpenChange,
}: CreateVisitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CreateVisitForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function recipientLabel(recipient: Recipient, organizationName?: string) {
  const details = [
    recipient.birthDate ? `${recipient.birthDate.slice(0, 4)}년생` : null,
    recipient.careGrade ? CARE_GRADE_LABELS[recipient.careGrade] : null,
    organizationName,
  ].filter(Boolean);
  return details.length > 0
    ? `${recipient.name} (${details.join(" · ")})`
    : recipient.name;
}

/** 담당자가 수급자와 같은 기관이고, 사업을 맡을 수 있는 직종인지(고르지 않은 조건은 건너뛴다). */
function fits(
  user: UserSummary,
  recipient: Recipient | undefined,
  program: Program | undefined,
) {
  return (
    (!recipient || user.organizationId === recipient.organizationId) &&
    (!program || canHandleProgram(program, user.profession))
  );
}

/** 폼의 사업 값("" 또는 사업 코드)을 사업으로 좁힌다. */
const toProgram = (value: string) => PROGRAMS.find((p) => p === value);

/** 수급자가 등록한 사업만 고를 수 있다(등록 사업은 기관 사업 안에 있다). */
const programsFor = (recipient: Recipient | undefined) =>
  recipient?.programs ?? [];

function CreateVisitForm({ onDone }: { onDone: () => void }) {
  const scopeOrganizationId = useScopeOrganizationId();
  // 운영자가 "전체 기관"을 볼 때만 있다. 선택 항목에 기관 이름을 붙인다.
  const organizationNames = useOrganizationColumnNames();
  const createVisit = useCreateVisit();

  const recipientsQuery = useRecipients({
    organizationId: scopeOrganizationId,
    includeInactive: "false",
  });
  const { staff, isPending: staffPending } = useVisitStaff(scopeOrganizationId);
  const recipients = recipientsQuery.data ?? [];

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateVisitFormSchema),
    defaultValues: {
      recipientId: "",
      program: "",
      staffId: "",
      date: formatKstDate(),
      time: "09:00",
    },
  });

  const recipientId = useWatch({ control, name: "recipientId" });
  const program = toProgram(useWatch({ control, name: "program" }));
  const staffId = useWatch({ control, name: "staffId" });
  const selectedRecipient = recipients.find((r) => r.id === recipientId);
  const programOptions = programsFor(selectedRecipient);
  const selectedStaff = staff.find((user) => user.id === staffId);

  // 작성 서식: 켜고 끈 선택 서식. 손대지 않은 서식은 규칙의 기본값을 따른다.
  const [formChoices, setFormChoices] = useState<FormChoices>({});
  const profession = selectedStaff?.profession ?? null;
  const formRules = program ? formRulesFor(program, profession) : [];
  const formIds = program
    ? resolveFormIds(program, profession, formChoices)
    : [];
  // 담당자는 수급자와 같은 기관이고, 고른 사업을 맡을 수 있는 직종이어야 한다.
  const staffOptions = staff.filter((user) =>
    fits(user, selectedRecipient, program),
  );
  // 수급자를 고르기 전에는 여러 기관의 담당자가 섞여 있어 기관 이름을 붙인다.
  const staffFromAllOrganizations =
    organizationNames !== undefined && !selectedRecipient;

  /** 수급자·사업을 바꿔 지금 담당자·사업이 맞지 않게 되면 비운다. */
  const clearMismatches = (nextRecipientId: string, nextProgram: string) => {
    const recipient = recipients.find((r) => r.id === nextRecipientId);
    const programs = programsFor(recipient);
    let programValue = toProgram(nextProgram);
    if (recipient) {
      if (programValue && !programs.includes(programValue)) {
        programValue = undefined;
      }
      // 사업이 하나뿐이면 바로 고른다.
      programValue ??= programs.length === 1 ? programs[0] : undefined;
      if ((programValue ?? "") !== getValues("program")) {
        setValue("program", programValue ?? "");
      }
    }
    const current = staff.find((user) => user.id === getValues("staffId"));
    if (current && !fits(current, recipient, programValue)) {
      setValue("staffId", "");
    }
  };

  const onSubmit = handleSubmit(
    ({ recipientId, program, staffId, date, time }) => {
      createVisit.mutate(
        {
          recipientId,
          program,
          staffId,
          scheduledAt: toKstIsoDateTime(date, time),
          formIds,
        },
        { onSuccess: onDone },
      );
    },
  );

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>방문 등록</DialogTitle>
        <DialogDescription>
          수급자·사업·담당자와 방문 예정 일시를 정합니다. 작성 서식은 사업과
          담당자 직종으로 정해지며 선택 서식은 고를 수 있습니다. 등록한 방문은
          현장 웹 일정에 바로 나타납니다.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <FormField
          label="수급자"
          htmlFor="create-visit-recipient"
          required
          error={
            errors.recipientId?.message ??
            (recipientsQuery.isError
              ? "수급자 목록을 불러오지 못했습니다"
              : undefined)
          }
          hint={
            recipientsQuery.isSuccess && recipients.length === 0
              ? "등록된 활성 수급자가 없습니다. 수급자 메뉴에서 먼저 등록해 주세요."
              : undefined
          }
        >
          <Controller
            control={control}
            name="recipientId"
            render={({ field }) => (
              <Select
                id="create-visit-recipient"
                autoFocus
                aria-invalid={!!errors.recipientId}
                disabled={recipientsQuery.isPending}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  clearMismatches(event.target.value, getValues("program"));
                }}
              >
                <option value="">
                  {recipientsQuery.isPending
                    ? "수급자 목록을 불러오는 중…"
                    : "수급자를 선택해 주세요"}
                </option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipientLabel(
                      recipient,
                      organizationNames?.get(recipient.organizationId),
                    )}
                  </option>
                ))}
              </Select>
            )}
          />
        </FormField>
        <FormField
          label="사업"
          htmlFor="create-visit-program"
          required
          error={errors.program?.message}
          hint={
            selectedRecipient && programOptions.length === 0
              ? "이 수급자의 등록 사업이 없습니다. 수급자 메뉴에서 등록 사업을 설정해 주세요."
              : undefined
          }
        >
          <Controller
            control={control}
            name="program"
            render={({ field }) => (
              <Select
                id="create-visit-program"
                aria-invalid={!!errors.program}
                disabled={!selectedRecipient}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  clearMismatches(getValues("recipientId"), event.target.value);
                }}
              >
                <option value="">
                  {selectedRecipient
                    ? "사업을 선택해 주세요"
                    : "수급자를 먼저 선택해 주세요"}
                </option>
                {programOptions.map((option) => (
                  <option key={option} value={option}>
                    {PROGRAM_LABELS[option]}
                  </option>
                ))}
              </Select>
            )}
          />
        </FormField>
        <FormField
          label="담당자"
          htmlFor="create-visit-staff"
          required
          error={errors.staffId?.message}
          hint={
            !staffPending && staffOptions.length === 0
              ? "조건에 맞는 활성 담당자가 없습니다. 사용자 메뉴에서 직종을 확인해 주세요."
              : undefined
          }
        >
          <Controller
            control={control}
            name="staffId"
            render={({ field }) => (
              <Select
                id="create-visit-staff"
                aria-invalid={!!errors.staffId}
                disabled={staffPending}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.value)}
              >
                <option value="">
                  {staffPending
                    ? "담당자 목록을 불러오는 중…"
                    : "담당자를 선택해 주세요"}
                </option>
                {staffOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {staffLabel(user, {
                      withOrganization: staffFromAllOrganizations,
                    })}
                  </option>
                ))}
              </Select>
            )}
          />
        </FormField>
        {selectedStaff && formRules.length > 0 && (
          <FormField
            label="작성 서식"
            hint="필수 서식은 뺄 수 없습니다. 현장 웹 기록 화면에서도 확정 전까지 바꿀 수 있습니다."
          >
            <CheckboxGroup
              label="작성 서식"
              options={formRules.map((rule) => ({
                value: rule.formId,
                label: formLabel(rule.formId),
                note: rule.required ? "필수" : rule.when,
                disabled: rule.required,
              }))}
              value={formIds}
              onChange={(next) =>
                setFormChoices((current) => ({
                  ...current,
                  ...Object.fromEntries(
                    formRules.map((rule) => [
                      rule.formId,
                      next.includes(rule.formId),
                    ]),
                  ),
                }))
              }
            />
          </FormField>
        )}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="방문 날짜"
            htmlFor="create-visit-date"
            required
            error={errors.date?.message}
          >
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DateInput
                  id="create-visit-date"
                  aria-invalid={!!errors.date}
                  {...field}
                />
              )}
            />
          </FormField>
          <FormField
            label="방문 시각"
            htmlFor="create-visit-time"
            required
            error={errors.time?.message}
          >
            <Input
              id="create-visit-time"
              type="time"
              aria-invalid={!!errors.time}
              {...register("time")}
            />
          </FormField>
        </div>
      </DialogBody>
      <FormDialogFooter
        submitText="등록"
        onCancel={onDone}
        isPending={createVisit.isPending}
      />
    </form>
  );
}
