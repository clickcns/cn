import { zodResolver } from "@hookform/resolvers/zod";
import { getErrorMessage } from "@repo/api-client";
import {
  canHandleProgram,
  HHMM_REGEX,
  PROGRAM_LABELS,
  PROGRAMS,
  toKstIsoDateTime,
  type Program,
} from "@repo/shared-types";
import { CalendarPlus, TriangleAlert } from "lucide-react";
import { useController, useForm, useFormState } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioChips } from "@/components/ui/choice-chips";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/features/auth/hooks/use-session";
import { RecipientPicker } from "@/features/recipients/components/recipient-picker";
import { useCreateVisit } from "@/features/visits/hooks/use-visit-mutations";
import { visitPath } from "@/lib/routes";

const NewVisitFormSchema = z.object({
  recipientId: z.string().min(1, "수급자를 선택해 주세요"),
  program: z.enum(PROGRAMS, "사업을 선택해 주세요"),
  date: z.iso.date("방문 날짜를 선택해 주세요"),
  time: z.string().regex(HHMM_REGEX, "방문 시각을 선택해 주세요"),
});
type NewVisitFormValues = z.infer<typeof NewVisitFormSchema>;

interface NewVisitFormProps {
  defaultDate: string;
  defaultRecipientId?: string;
}

export function NewVisitForm({
  defaultDate,
  defaultRecipientId,
}: NewVisitFormProps) {
  const navigate = useNavigate();
  const createVisit = useCreateVisit();
  const user = useCurrentUser();
  // 기관이 하는 사업 중 내 직종이 맡을 수 있는 것만(서버도 같은 규칙).
  const programs: Program[] = (user?.programs ?? []).filter((program) =>
    canHandleProgram(program, user?.profession ?? null),
  );

  const { control, register, handleSubmit } = useForm<NewVisitFormValues>({
    resolver: zodResolver(NewVisitFormSchema),
    defaultValues: {
      recipientId: defaultRecipientId ?? "",
      program: programs[0],
      date: defaultDate,
      time: "09:00",
    },
  });
  const { errors } = useFormState({ control });
  const { field: recipientField } = useController({
    control,
    name: "recipientId",
  });
  const { field: programField } = useController({ control, name: "program" });

  const onSubmit = handleSubmit((values) => {
    createVisit.mutate(
      {
        recipientId: values.recipientId,
        program: values.program,
        scheduledAt: toKstIsoDateTime(values.date, values.time),
      },
      {
        onSuccess: (visit) => {
          toast.success("방문을 추가했습니다");
          navigate(visitPath(visit.id), { replace: true });
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, "방문을 추가하지 못했습니다"));
        },
      },
    );
  });

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start md:gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>수급자 선택</CardTitle>
        </CardHeader>
        <RecipientPicker
          value={recipientField.value}
          onChange={recipientField.onChange}
          invalid={Boolean(errors.recipientId)}
          describedBy={
            errors.recipientId ? "new-visit-recipient-error" : undefined
          }
        />
        {errors.recipientId && (
          <p id="new-visit-recipient-error" className="text-destructive">
            {errors.recipientId.message}
          </p>
        )}
      </Card>

      <Card className="md:sticky md:top-24">
        {programs.length === 0 ? (
          <p className="text-warning flex items-start gap-2 font-semibold">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />이 계정은 방문을
            맡을 수 없습니다. 기관 관리자에게 직종과 기관 사업을 확인해 주세요.
          </p>
        ) : (
          programs.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="text-base font-semibold">사업</span>
              <RadioChips
                label="사업"
                options={programs.map((program) => ({
                  value: program,
                  label: PROGRAM_LABELS[program],
                }))}
                value={programField.value ?? null}
                onChange={(value) => {
                  if (value) programField.onChange(value);
                }}
              />
            </div>
          )
        )}
        <CardHeader>
          <CardTitle>방문 일시</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-visit-date">날짜</Label>
            <Input
              id="new-visit-date"
              type="date"
              className="text-lg tabular-nums"
              aria-invalid={errors.date ? true : undefined}
              {...register("date")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-visit-time">시각</Label>
            <Input
              id="new-visit-time"
              type="time"
              className="text-lg tabular-nums"
              aria-invalid={errors.time ? true : undefined}
              {...register("time")}
            />
          </div>
        </div>
        {(errors.date || errors.time || errors.program) && (
          <p className="text-destructive">
            {errors.date?.message ??
              errors.time?.message ??
              errors.program?.message}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={createVisit.isPending || programs.length === 0}
        >
          <CalendarPlus />
          {createVisit.isPending ? "추가하는 중…" : "방문 추가"}
        </Button>
      </Card>
    </form>
  );
}
