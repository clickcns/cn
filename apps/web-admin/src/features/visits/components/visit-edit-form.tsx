import { getErrorMessage } from "@repo/api-client";
import {
  canHandleProgram,
  canReassignVisit,
  choicesForNewStaff,
  formRulesFor,
  HHMM_REGEX,
  isIsoDate,
  resolveFormIds,
  toKstIsoDateTime,
  type FormChoices,
  type UpdateVisitInput,
} from "@repo/shared-types";
import { InfoIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DateInput } from "@/components/ui/date-input";
import {
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useVisitStaff } from "@/features/users/hooks/use-users";
import { staffLabel } from "@/features/users/lib/staff-label";
import { FormRuleCheckboxes } from "@/features/visits/components/form-rule-checkboxes";
import { SameDayWarnings } from "@/features/visits/components/same-day-warnings";
import {
  useSameDayWarnings,
  useUpdateVisit,
} from "@/features/visits/hooks/use-visits";
import {
  visitDate,
  visitTime,
  type QuickViewVisit,
} from "@/features/visits/lib/calendar-items";

interface VisitEditFormProps {
  visit: QuickViewVisit;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * 방문 일정·담당자 바꾸기. 바뀐 것만 보내고, 화면이 본 일시를 함께 보내
 * 그사이 다른 사람이 옮겼으면 서버가 거절한다(409).
 */
export function VisitEditForm({ visit, onDone, onCancel }: VisitEditFormProps) {
  const [date, setDate] = useState(visitDate(visit));
  const [time, setTime] = useState(visitTime(visit));
  const [staffId, setStaffId] = useState(visit.staff.id);
  // 새 담당자에게 넘길 때 켜고 끈 선택 서식. 손대지 않은 서식은 이어받은 값을 따른다.
  const [formChoices, setFormChoices] = useState<FormChoices>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const updateVisit = useUpdateVisit();

  const reassignable = canReassignVisit(visit.status);
  const { staff, isPending: staffPending } = useVisitStaff(
    visit.organizationId,
  );
  // 이 사업을 맡을 수 있는 같은 기관의 활성 담당자만 고를 수 있다.
  const staffOptions = staff.filter((user) =>
    canHandleProgram(visit.program, user.profession),
  );
  const staffChanged = staffId !== visit.staff.id;
  const newProfession =
    staffOptions.find((user) => user.id === staffId)?.profession ?? null;

  const formRules = staffChanged
    ? formRulesFor(visit.program, newProfession)
    : [];
  // 새 담당자에게 넘길 때: 두 직종에 모두 있는 선택 서식은 지금 선택을 잇고, 이 창에서 켜고 끈 것을 얹는다.
  const formIds = staffChanged
    ? resolveFormIds(visit.program, newProfession, {
        ...choicesForNewStaff(
          visit.program,
          visit.formIds,
          visit.profession,
          newProfession,
        ),
        ...formChoices,
      })
    : visit.formIds;

  const dateValid = isIsoDate(date);
  const timeValid = HHMM_REGEX.test(time);
  const scheduledAt =
    dateValid && timeValid ? toKstIsoDateTime(date, time) : null;
  const scheduleChanged =
    scheduledAt !== null &&
    new Date(scheduledAt).getTime() !== new Date(visit.scheduledAt).getTime();

  // 날짜나 담당자(직종)를 바꿨을 때만 같은 날 겹침을 확인한다.
  const { data: sameDayWarnings = [] } = useSameDayWarnings(
    dateValid && (date !== visitDate(visit) || staffChanged)
      ? {
          recipientId: visit.recipient.id,
          program: visit.program,
          staffId,
          date,
        }
      : null,
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!dateValid || !timeValid) {
      setSubmitError("방문 날짜와 시각을 확인해 주세요");
      return;
    }
    if (!scheduleChanged && !staffChanged) {
      onCancel();
      return;
    }
    const input: UpdateVisitInput = { expectedScheduledAt: visit.scheduledAt };
    if (scheduleChanged && scheduledAt) input.scheduledAt = scheduledAt;
    if (staffChanged) {
      input.staffId = staffId;
      input.formIds = formIds;
    }
    setSubmitError(null);
    updateVisit.mutate(
      { id: visit.id, input },
      {
        onSuccess: () => {
          toast.success("방문 정보를 바꿨습니다");
          onDone();
        },
        onError: (error) => setSubmitError(getErrorMessage(error)),
      },
    );
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>방문 일정·담당자 변경</DialogTitle>
        <DialogDescription>
          {visit.recipient.name} 방문의 날짜·시각과 담당자를 바꿉니다. 바뀐
          일정은 담당자의 현장 웹 일정에도 반영됩니다.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        {visit.status === "DRAFT" && (
          <p className="bg-muted text-muted-foreground flex items-start gap-2 rounded-md px-3 py-2 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            기록을 쓰기 시작한 방문입니다. 예정 일시만 바뀌고, 담당자가 기록한
            실제 방문 시각은 그대로입니다.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="방문 날짜"
            htmlFor="edit-visit-date"
            required
            error={!dateValid ? "날짜를 YYYY-MM-DD로 입력해 주세요" : undefined}
          >
            <DateInput
              id="edit-visit-date"
              aria-invalid={!dateValid}
              value={date}
              onChange={setDate}
            />
          </FormField>
          <FormField
            label="방문 시각"
            htmlFor="edit-visit-time"
            required
            error={!timeValid ? "시각을 입력해 주세요" : undefined}
          >
            <Input
              id="edit-visit-time"
              type="time"
              aria-invalid={!timeValid}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </FormField>
        </div>
        <FormField
          label="담당자"
          htmlFor="edit-visit-staff"
          hint={
            reassignable
              ? "이 사업을 맡을 수 있는 같은 기관의 담당자만 고를 수 있습니다."
              : "기록을 쓰기 시작한 방문은 담당자를 바꿀 수 없습니다."
          }
        >
          <Select
            id="edit-visit-staff"
            value={staffId}
            disabled={!reassignable || staffPending}
            onChange={(event) => {
              setStaffId(event.target.value);
              setFormChoices({});
            }}
          >
            {!staffOptions.some((user) => user.id === visit.staff.id) && (
              <option value={visit.staff.id}>
                {visit.staff.name} (현재 담당자)
              </option>
            )}
            {staffOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {staffLabel(user)}
                {user.id === visit.staff.id ? " · 현재" : ""}
              </option>
            ))}
          </Select>
        </FormField>
        {staffChanged && formRules.length > 0 && (
          <FormField
            label="작성 서식"
            hint="새 담당자의 직종에 맞춘 서식입니다. 필수 서식은 뺄 수 없습니다."
          >
            <FormRuleCheckboxes
              rules={formRules}
              value={formIds}
              onChange={setFormChoices}
            />
          </FormField>
        )}
        {staffChanged && (
          <p className="text-muted-foreground text-[13px]">
            지금 담당자가 현장 웹에서 이 방문을 열어 두었다면, 그 화면에서는 더
            이상 저장·녹음할 수 없습니다.
          </p>
        )}
        <SameDayWarnings warnings={sameDayWarnings} />
        {submitError && (
          <p role="alert" className="text-destructive text-sm">
            {submitError}
          </p>
        )}
      </DialogBody>
      <FormDialogFooter
        submitText="바꾸기"
        onCancel={onCancel}
        isPending={updateVisit.isPending}
      />
    </form>
  );
}
