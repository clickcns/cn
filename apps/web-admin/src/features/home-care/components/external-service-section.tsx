import { zodResolver } from "@hookform/resolvers/zod";
import {
  EXTERNAL_SERVICE_INFO,
  EXTERNAL_SERVICE_KINDS,
  ExternalServiceSchema,
  externalServiceLabel,
  formatWeekdays,
  WEEKDAY_LABELS,
  type ExternalService,
  type ExternalServiceInput,
} from "@repo/shared-types";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateInput } from "@/components/ui/date-input";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CaseSection } from "@/features/home-care/components/case-section";
import { useHomeCareCaseMutation } from "@/features/home-care/hooks/use-home-care-case";
import { api } from "@/lib/api";
import { formatYearDate } from "@/lib/format";

const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, day) => ({
  value: day,
  label,
}));

/** 이용 시간이 겹칠 때만 해당하는 서비스 이름들(설명 글). */
const TIMED_LABELS = EXTERNAL_SERVICE_KINDS.filter(
  (kind) => EXTERNAL_SERVICE_INFO[kind].timed,
)
  .map((kind) => EXTERNAL_SERVICE_INFO[kind].label)
  .join("·");

/** "2026년 10월 1일 ~ 2026년 10월 31일", 끝이 없으면 "2026년 10월 1일부터" */
function formatPeriod(service: ExternalService): string | null {
  const { startsOn, endsOn } = service;
  if (startsOn && endsOn) {
    return startsOn === endsOn
      ? formatYearDate(startsOn)
      : `${formatYearDate(startsOn)} ~ ${formatYearDate(endsOn)}`;
  }
  if (startsOn) return `${formatYearDate(startsOn)}부터`;
  if (endsOn) return `${formatYearDate(endsOn)}까지`;
  return null;
}

/**
 * 다른 기관 서비스: 같은 날(주야간보호·방문목욕·사회복지사 급여관리는 이용 시간) 재택의료팀이
 * 방문하면 재택의료 급여를 산정하지 않는 서비스의 일정. 판정이 그 방문을 횟수에서 빼고, 방문을
 * 등록할 때도 경고한다.
 */
export function ExternalServiceSection({
  recipientId,
  services,
}: {
  recipientId: string;
  services: readonly ExternalService[];
}) {
  // null: 목록만, "new": 더하는 중, 그 밖: 고치는 서비스
  const [editing, setEditing] = useState<ExternalService | "new" | null>(null);
  const [removing, setRemoving] = useState<ExternalService | null>(null);
  const remove = useHomeCareCaseMutation(recipientId, (id: string) =>
    api.recipients.removeExternalService(recipientId, id),
  );

  return (
    <CaseSection
      title="다른 기관 서비스"
      description={`같은 날(${TIMED_LABELS}는 이용 시간에) 재택의료팀이 방문하면 재택의료 급여를 산정하지 않습니다. 일정을 적으면 판정이 그 방문을 빼고, 방문을 등록할 때 경고합니다.`}
    >
      {services.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          적어 둔 다른 기관 서비스가 없습니다.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-md border">
          {services.map((service) =>
            editing !== "new" && editing?.id === service.id ? (
              <li key={service.id} className="p-3">
                <ServiceForm
                  recipientId={recipientId}
                  service={service}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={service.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="grid gap-0.5 text-sm">
                  <span className="font-medium">
                    {externalServiceLabel(service)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {[
                      formatWeekdays(service.weekdays),
                      formatPeriod(service),
                      service.note,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${EXTERNAL_SERVICE_INFO[service.kind].label} 고치기`}
                    onClick={() => setEditing(service)}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${EXTERNAL_SERVICE_INFO[service.kind].label} 지우기`}
                    onClick={() => setRemoving(service)}
                  >
                    <Trash2Icon />
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      {editing === "new" ? (
        <div className="rounded-md border p-3">
          <ServiceForm
            recipientId={recipientId}
            service={null}
            onDone={() => setEditing(null)}
          />
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => setEditing("new")}
        >
          <PlusIcon />
          서비스 더하기
        </Button>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="다른 기관 서비스를 지울까요?"
        description={
          removing &&
          `${externalServiceLabel(removing)} 일정을 지웁니다. 그날 방문을 다시 재택의료 급여로 셉니다.`
        }
        confirmText="지우기"
        destructive
        isPending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              setRemoving(null);
              toast.success("다른 기관 서비스를 지웠습니다");
            },
          })
        }
      />
    </CaseSection>
  );
}

/** 서비스 더하기(service null)·고치기. */
function ServiceForm({
  recipientId,
  service,
  onDone,
}: {
  recipientId: string;
  service: ExternalService | null;
  onDone: () => void;
}) {
  const save = useHomeCareCaseMutation(
    recipientId,
    (input: ExternalServiceInput) =>
      service
        ? api.recipients.updateExternalService(recipientId, service.id, input)
        : api.recipients.addExternalService(recipientId, input),
  );
  const form = useForm({
    resolver: zodResolver(ExternalServiceSchema),
    defaultValues: {
      kind: service?.kind ?? "LTC_NURSING",
      provider: service?.provider ?? "",
      weekdays: service?.weekdays ?? [],
      startsOn: service?.startsOn ?? "",
      endsOn: service?.endsOn ?? "",
      startTime: service?.startTime ?? "",
      endTime: service?.endTime ?? "",
      note: service?.note ?? "",
    },
  });
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const kind = useWatch({ control, name: "kind" });
  const timed = EXTERNAL_SERVICE_INFO[kind].timed;
  const id = (name: string) =>
    `external-service-${service?.id ?? "new"}-${name}`;

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => {
        toast.success(
          service
            ? "다른 기관 서비스를 고쳤습니다"
            : "다른 기관 서비스를 더했습니다",
        );
        onDone();
      },
    }),
  );

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="서비스" htmlFor={id("kind")}>
          <Select
            id={id("kind")}
            {...register("kind", {
              // 이용 시간을 쓰지 않는 서비스로 바꾸면 숨기는 시간 칸을 비운다.
              onChange: (event: { target: { value: string } }) => {
                const next = event.target.value as ExternalServiceInput["kind"];
                if (!EXTERNAL_SERVICE_INFO[next].timed) {
                  form.setValue("startTime", "");
                  form.setValue("endTime", "");
                }
              },
            })}
          >
            {EXTERNAL_SERVICE_KINDS.map((option) => (
              <option key={option} value={option}>
                {EXTERNAL_SERVICE_INFO[option].label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="제공 기관"
          htmlFor={id("provider")}
          error={errors.provider?.message}
        >
          <Input
            id={id("provider")}
            placeholder="선택"
            maxLength={100}
            {...register("provider")}
          />
        </FormField>
      </div>
      <FormField label="요일" hint="고르지 않으면 기간 안의 모든 날입니다.">
        <Controller
          control={control}
          name="weekdays"
          render={({ field }) => (
            <CheckboxGroup
              label="이용 요일"
              className="flex flex-wrap gap-x-4 gap-y-2"
              options={WEEKDAY_OPTIONS}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="시작하는 날"
          htmlFor={id("startsOn")}
          error={errors.startsOn?.message}
          hint="비우면 처음부터"
        >
          <Controller
            control={control}
            name="startsOn"
            render={({ field }) => (
              <DateInput
                id={id("startsOn")}
                aria-invalid={!!errors.startsOn}
                {...field}
                value={field.value ?? ""}
              />
            )}
          />
        </FormField>
        <FormField
          label="끝나는 날"
          htmlFor={id("endsOn")}
          error={errors.endsOn?.message}
          hint="비우면 끝없이"
        >
          <Controller
            control={control}
            name="endsOn"
            render={({ field }) => (
              <DateInput
                id={id("endsOn")}
                aria-invalid={!!errors.endsOn}
                {...field}
                value={field.value ?? ""}
              />
            )}
          />
        </FormField>
      </div>
      {timed && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="이용 시작 시각" htmlFor={id("startTime")}>
            <Input
              id={id("startTime")}
              type="time"
              {...register("startTime")}
            />
          </FormField>
          <FormField
            label="이용 끝 시각"
            htmlFor={id("endTime")}
            error={errors.endTime?.message}
            hint="시간을 적으면 그 시간에 겹친 방문만 뺍니다. 비우면 같은 날 방문을 '겹칠 수 있음'으로 알립니다."
          >
            <Input
              id={id("endTime")}
              type="time"
              aria-invalid={!!errors.endTime}
              {...register("endTime")}
            />
          </FormField>
        </div>
      )}
      <FormField label="메모" htmlFor={id("note")} error={errors.note?.message}>
        <Input
          id={id("note")}
          placeholder="선택"
          maxLength={200}
          {...register("note")}
        />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {service ? "저장" : "더하기"}
        </Button>
      </div>
    </form>
  );
}
