import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateHomeCareFeeScheduleSchema,
  formatMonthLabel,
  HOME_CARE_FEE_GROUPS,
  type HomeCareFeeSchedule,
  type HomeCareFeeScheduleList,
} from "@repo/shared-types";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { MonthNav } from "@/components/month-nav";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateFeeSchedule,
  useUpdateFeeSchedule,
} from "@/features/fee-schedules/hooks/use-fee-schedules";
import { feesBefore, formatFee } from "@/features/fee-schedules/lib/fee-format";
import { cn } from "@/lib/utils";

/**
 * 수가 넣기·고치기(운영자). 넣을 때는 기본 시행 월 바로 전 달 수가로 시작하고 바꾼 칸을 고른 시행 월
 * 전 달 수가와 견주며, 고칠 때는 그 묶음 값으로 시작하고 고치기 전 값과 견준다. 근거(지침 판·쪽)는
 * 꼭 적는다. 같은 시행 월에 지우지 않은 다른 수가가 있으면 저장하지 못한다(서버도 409).
 */
export function FeeScheduleDialog({
  open,
  onOpenChange,
  list,
  editing,
  thisMonth,
  defaultMonth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: HomeCareFeeScheduleList;
  /** 고칠 묶음. null이면 새로 넣는다 */
  editing: HomeCareFeeSchedule | null;
  thisMonth: string;
  defaultMonth: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <FeeScheduleForm
            key={editing?.id ?? "new"}
            list={list}
            editing={editing}
            thisMonth={thisMonth}
            defaultMonth={defaultMonth}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FeeScheduleForm({
  list,
  editing,
  thisMonth,
  defaultMonth,
  onDone,
}: {
  list: HomeCareFeeScheduleList;
  editing: HomeCareFeeSchedule | null;
  thisMonth: string;
  defaultMonth: string;
  onDone: () => void;
}) {
  const create = useCreateFeeSchedule();
  const update = useUpdateFeeSchedule();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(CreateHomeCareFeeScheduleSchema),
    defaultValues: editing
      ? {
          effectiveMonth: editing.effectiveMonth,
          fees: editing.fees,
          source: editing.source,
          note: editing.note ?? "",
        }
      : {
          effectiveMonth: defaultMonth,
          fees: feesBefore(list, defaultMonth),
          source: "",
          note: "",
        },
  });
  const month = useWatch({ control, name: "effectiveMonth" });
  const values = useWatch({ control, name: "fees" });
  const previous = editing ? editing.fees : feesBefore(list, month);
  const taken = list.schedules.some(
    (schedule) =>
      schedule.effectiveMonth === month &&
      !schedule.deletedAt &&
      schedule.id !== editing?.id,
  );

  const onSubmit = handleSubmit((input) => {
    if (taken) return;
    const label = formatMonthLabel(input.effectiveMonth);
    if (!editing) {
      create.mutate(input, {
        onSuccess: () => {
          toast.success(`${label}부터 쓸 수가를 넣었습니다`);
          onDone();
        },
      });
      return;
    }
    if (!isDirty) {
      toast.info("고친 칸이 없습니다");
      return;
    }
    update.mutate(
      { id: editing.id, input },
      {
        onSuccess: () => {
          toast.success(`${label} 수가를 고쳤습니다`);
          onDone();
        },
      },
    );
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>{editing ? "수가 고치기" : "새 수가 넣기"}</DialogTitle>
        <DialogDescription>
          {editing
            ? `고친 값으로 바꿉니다. 고치기 전 값은 이력에 "고침"으로 남고, 그 달부터 고친 값으로 다시 셉니다.`
            : "모든 기관의 재택의료 수입에 쓰입니다. 지침이 바뀐 달을 시행 월로 고르고, 바뀐 칸만 고치면 됩니다."}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-5">
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <FormField
            label="시행 월"
            required
            error={
              taken
                ? "이 달에 넣은 수가가 이미 있습니다. 그 수가를 고치거나 지운 뒤 다시 해 주세요"
                : undefined
            }
          >
            <Controller
              control={control}
              name="effectiveMonth"
              render={({ field }) => (
                <MonthNav
                  month={field.value}
                  thisMonth={thisMonth}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField
            label="근거(지침 판·쪽)"
            htmlFor="fee-source"
            required
            error={errors.source?.message}
          >
            <Input
              id="fee-source"
              maxLength={200}
              placeholder="예: 재택의료센터 지침 2027.1판 19쪽"
              aria-invalid={!!errors.source}
              {...register("source")}
            />
          </FormField>
        </div>

        {HOME_CARE_FEE_GROUPS.map(({ group, fields }) => (
          <section key={group} className="grid gap-3">
            <h3 className="text-muted-foreground text-xs font-semibold">
              {group}
            </h3>
            <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2">
              {fields.map((field) => {
                const id = `fee-${field.key}`;
                const before = previous[field.key];
                const value = values[field.key];
                const changed = !Number.isNaN(value) && value !== before;
                const error = errors.fees?.[field.key]?.message;
                return (
                  <FormField
                    key={field.key}
                    label={`${field.label} (${field.unit})`}
                    htmlFor={id}
                    error={error}
                    hint={
                      changed
                        ? `${editing ? "고치기 전" : "이전"} ${formatFee(field, before)}`
                        : undefined
                    }
                  >
                    <Input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      step={field.unit === "%" ? 0.1 : 1}
                      aria-invalid={!!error}
                      className={cn(
                        "tabular-nums",
                        changed && "border-primary bg-primary-soft",
                      )}
                      {...register(`fees.${field.key}`, {
                        valueAsNumber: true,
                      })}
                    />
                  </FormField>
                );
              })}
            </div>
          </section>
        ))}

        <FormField label="메모" htmlFor="fee-note" error={errors.note?.message}>
          <Textarea
            id="fee-note"
            maxLength={500}
            rows={2}
            placeholder={editing ? "고친 까닭(선택)" : "선택"}
            {...register("note")}
          />
        </FormField>
      </DialogBody>
      <FormDialogFooter
        submitText={editing ? "고치기" : "넣기"}
        onCancel={onDone}
        isPending={create.isPending || update.isPending}
      />
    </form>
  );
}
