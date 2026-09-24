import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { getErrorMessage } from "@repo/api-client";
import {
  canHandleProgram,
  formRulesFor,
  hasOptionalForms,
  HHMM_REGEX,
  PROGRAM_LABELS,
  resolveFormIds,
  toKstIsoDateTime,
  type FormChoices,
  type Program,
} from "@repo/shared-types";
import { CalendarPlus, TriangleAlert } from "lucide-react";
import {
  Controller,
  useController,
  useForm,
  useFormState,
} from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioChips } from "@/components/ui/choice-chips";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/features/auth/hooks/use-session";
import { FormChoiceList } from "@/features/forms/components/form-choice-list";
import { RecipientPicker } from "@/features/recipients/components/recipient-picker";
import { useRecipients } from "@/features/recipients/hooks/use-recipients";
import { useCreateVisit } from "@/features/visits/hooks/use-visit-mutations";
import { visitPath } from "@/lib/routes";

const NewVisitFormSchema = z.object({
  recipientId: z.string().min(1, "수급자를 선택해 주세요"),
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
  const profession = user?.profession ?? null;
  // 기관이 하는 사업 중 내 직종이 맡을 수 있는 것만(서버도 같은 규칙).
  const myPrograms: Program[] = (user?.programs ?? []).filter((program) =>
    canHandleProgram(program, profession),
  );

  const { control, register, handleSubmit } = useForm<NewVisitFormValues>({
    resolver: zodResolver(NewVisitFormSchema),
    defaultValues: {
      recipientId: defaultRecipientId ?? "",
      date: defaultDate,
      time: "09:00",
    },
  });
  const { errors } = useFormState({ control });
  const { field: recipientField } = useController({
    control,
    name: "recipientId",
  });
  // 선택 목록(RecipientPicker)이 처음 받는 전체 목록과 같은 쿼리라 따로 요청하지 않는다.
  const recipientsQuery = useRecipients("");
  const recipient = recipientsQuery.data?.find(
    (r) => r.id === recipientField.value,
  );
  const recipientLoading =
    Boolean(recipientField.value) && recipientsQuery.isPending;
  // 수급자가 등록한 사업 중 내 직종이 맡을 수 있는 것(등록 사업은 기관 사업 안에 있다).
  // 고른 칩이 맞지 않으면 첫 사업으로 둔다.
  const programs = recipient
    ? recipient.programs.filter((option) => myPrograms.includes(option))
    : [];
  const [chosenProgram, setChosenProgram] = useState<Program>();
  const program =
    chosenProgram && programs.includes(chosenProgram)
      ? chosenProgram
      : programs[0];
  const noProgramForRecipient = Boolean(recipient) && programs.length === 0;

  // 켜고 끈 선택 서식. 손대지 않은 서식은 규칙의 기본값을 따른다.
  const [formChoices, setFormChoices] = useState<FormChoices>({});
  const formIds = program
    ? resolveFormIds(program, profession, formChoices)
    : [];

  const onSubmit = handleSubmit((values) => {
    if (!program) {
      // 목록에 없는 수급자(사용 중지 등)가 넘어왔거나 목록을 받지 못한 경우
      toast.error(
        recipient
          ? "이 수급자에게 맡을 수 있는 사업이 없습니다"
          : "수급자를 찾을 수 없습니다. 수급자를 다시 선택해 주세요",
      );
      return;
    }
    createVisit.mutate(
      {
        recipientId: values.recipientId,
        program,
        scheduledAt: toKstIsoDateTime(values.date, values.time),
        formIds,
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
        {myPrograms.length === 0 ? (
          <p className="text-warning flex items-start gap-2 font-semibold">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />이 계정은 방문을
            맡을 수 없습니다. 기관 관리자에게 직종과 기관 사업을 확인해 주세요.
          </p>
        ) : noProgramForRecipient ? (
          <p className="text-warning flex items-start gap-2 font-semibold">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />이 수급자는 내가
            맡을 수 있는 사업에 등록되어 있지 않습니다. 기관 관리자에게 수급자의
            등록 사업을 확인해 주세요.
          </p>
        ) : (
          programs.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="text-base font-semibold">사업</span>
              <RadioChips
                label="사업"
                options={programs.map((option) => ({
                  value: option,
                  label: PROGRAM_LABELS[option],
                }))}
                value={program ?? null}
                onChange={(value) => {
                  if (value) setChosenProgram(value as Program);
                }}
              />
            </div>
          )
        )}
        {program && hasOptionalForms(program, profession) && (
          <div className="flex flex-col gap-2">
            <span className="text-base font-semibold">작성 서식</span>
            <FormChoiceList
              idPrefix="new-visit-form"
              rules={formRulesFor(program, profession)}
              selected={formIds}
              onToggle={(formId, on) =>
                setFormChoices((current) => ({ ...current, [formId]: on }))
              }
            />
            <p className="text-muted-foreground text-sm">
              방문 기록 화면에서도 확정 전까지 바꿀 수 있습니다.
            </p>
          </div>
        )}
        <CardHeader>
          <CardTitle>방문 일시</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-visit-date">날짜</Label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DateInput
                  id="new-visit-date"
                  className="text-lg tabular-nums"
                  aria-invalid={errors.date ? true : undefined}
                  {...field}
                />
              )}
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
        {(errors.date || errors.time) && (
          <p className="text-destructive">
            {errors.date?.message ?? errors.time?.message}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={
            createVisit.isPending ||
            myPrograms.length === 0 ||
            recipientLoading ||
            noProgramForRecipient
          }
        >
          <CalendarPlus />
          {createVisit.isPending ? "추가하는 중…" : "방문 추가"}
        </Button>
      </Card>
    </form>
  );
}
