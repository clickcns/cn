import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateHomeCareFeeScheduleSchema,
  formatMonthLabel,
  HOME_CARE_FEE_GROUPS,
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
import { useCreateFeeSchedule } from "@/features/fee-schedules/hooks/use-fee-schedules";
import { feesBefore, formatFee } from "@/features/fee-schedules/lib/fee-format";
import { cn } from "@/lib/utils";

/**
 * 새 수가 넣기(운영자). 시작 값은 기본 시행 월 바로 전 달 수가이고, 바꾼 칸은 고른 시행 월 전 달
 * 수가와 견줘 이전 값과 함께 강조한다. 근거(지침 판·쪽)는 꼭 적는다. 같은 시행 월에 지우지 않은
 * 수가가 있으면 넣지 못한다(서버도 409).
 */
export function CreateFeeScheduleDialog({
  open,
  onOpenChange,
  list,
  thisMonth,
  defaultMonth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: HomeCareFeeScheduleList;
  thisMonth: string;
  defaultMonth: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <CreateForm
            list={list}
            thisMonth={thisMonth}
            defaultMonth={defaultMonth}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateForm({
  list,
  thisMonth,
  defaultMonth,
  onDone,
}: {
  list: HomeCareFeeScheduleList;
  thisMonth: string;
  defaultMonth: string;
  onDone: () => void;
}) {
  const create = useCreateFeeSchedule();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateHomeCareFeeScheduleSchema),
    defaultValues: {
      effectiveMonth: defaultMonth,
      fees: feesBefore(list, defaultMonth),
      source: "",
      note: "",
    },
  });
  const month = useWatch({ control, name: "effectiveMonth" });
  const values = useWatch({ control, name: "fees" });
  const previous = feesBefore(list, month);
  const taken = list.schedules.some(
    (schedule) => schedule.effectiveMonth === month && !schedule.deletedAt,
  );

  const onSubmit = handleSubmit((input) => {
    if (taken) return;
    create.mutate(input, {
      onSuccess: () => {
        toast.success(
          `${formatMonthLabel(input.effectiveMonth)}부터 쓸 수가를 넣었습니다`,
        );
        onDone();
      },
    });
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>새 수가 넣기</DialogTitle>
        <DialogDescription>
          모든 기관의 재택의료 수입에 쓰입니다. 지침이 바뀐 달을 시행 월로
          고르고, 바뀐 칸만 고치면 됩니다.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-5">
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <FormField
            label="시행 월"
            required
            error={
              taken
                ? "이 달에 넣은 수가가 이미 있습니다. 이력에서 지우고 다시 넣어 주세요"
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
                      changed ? `이전 ${formatFee(field, before)}` : undefined
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
            placeholder="선택"
            {...register("note")}
          />
        </FormField>
      </DialogBody>
      <FormDialogFooter
        submitText="넣기"
        onCancel={onDone}
        isPending={create.isPending}
      />
    </form>
  );
}
