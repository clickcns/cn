import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateHomeCareAssessmentSchema,
  formatKstDate,
  HOME_CARE_ASSESSMENT_KIND_LABELS,
  HOME_CARE_ASSESSMENT_KINDS,
  reassessmentWindow,
  type CreateHomeCareAssessmentInput,
  type HomeCareAssessment,
} from "@repo/shared-types";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateInput } from "@/components/ui/date-input";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CaseSection } from "@/features/home-care/components/case-section";
import { useHomeCareCaseMutation } from "@/features/home-care/hooks/use-home-care-case";
import { api } from "@/lib/api";
import { formatYearDate } from "@/lib/format";

/**
 * 포괄평가 기록: 평가한 날 목록(마지막 평가의 다음 재평가 기간)과 더하기. 최초 평가 달은 평가일부터,
 * 재평가 기한(평가한 달의 13개월 뒤 말일)이 지나면 다시 평가할 때까지 재택의료 급여를 산정하지 않는다.
 */
export function AssessmentSection({
  recipientId,
  assessments,
}: {
  recipientId: string;
  assessments: readonly HomeCareAssessment[];
}) {
  const [removing, setRemoving] = useState<HomeCareAssessment | null>(null);
  const remove = useHomeCareCaseMutation(recipientId, (id: string) =>
    api.recipients.removeAssessment(recipientId, id),
  );
  const last = assessments.at(-1);
  const nextWindow = last && reassessmentWindow(last.assessedOn);

  return (
    <CaseSection
      title="포괄평가"
      description="별지 제5호를 쓴 날을 적습니다. 최초 평가 달은 평가일부터 요건을 세고, 재평가 기한이 지나면 다시 평가할 때까지 재택의료 급여를 산정하지 않습니다."
    >
      {assessments.length === 0 ? (
        <p className="text-warning text-sm">
          기록한 포괄평가가 없습니다. 기록하기 전에는 달 전체를 세고 평가 기한을
          보지 않습니다.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-md border">
          {assessments.map((assessment) => (
            <li
              key={assessment.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="grid gap-0.5 text-sm">
                <span>
                  <span className="font-medium">
                    {formatYearDate(assessment.assessedOn)}
                  </span>{" "}
                  · {HOME_CARE_ASSESSMENT_KIND_LABELS[assessment.kind]}
                </span>
                <span className="text-muted-foreground text-xs">
                  {[assessment.note, `기록 ${assessment.createdBy.name}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${formatYearDate(assessment.assessedOn)} 포괄평가 지우기`}
                onClick={() => setRemoving(assessment)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {nextWindow && (
        <p className="text-muted-foreground text-sm">
          다음 재평가: {formatYearDate(nextWindow.from)} ~{" "}
          <span className="text-foreground font-medium">
            {formatYearDate(nextWindow.deadline)}
          </span>
          까지
        </p>
      )}
      <AddAssessmentForm
        recipientId={recipientId}
        hasInitial={assessments.some((item) => item.kind === "INITIAL")}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="포괄평가 기록을 지울까요?"
        description={
          removing &&
          `${formatYearDate(removing.assessedOn)} ${HOME_CARE_ASSESSMENT_KIND_LABELS[removing.kind]} 기록을 지웁니다. 그 뒤 달의 산정 기간과 재평가 기한이 다시 계산됩니다.`
        }
        confirmText="지우기"
        destructive
        isPending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              setRemoving(null);
              toast.success("포괄평가 기록을 지웠습니다");
            },
          })
        }
      />
    </CaseSection>
  );
}

function AddAssessmentForm({
  recipientId,
  hasInitial,
}: {
  recipientId: string;
  hasInitial: boolean;
}) {
  const add = useHomeCareCaseMutation(
    recipientId,
    (input: CreateHomeCareAssessmentInput) =>
      api.recipients.addAssessment(recipientId, input),
  );
  const form = useForm({
    resolver: zodResolver(CreateHomeCareAssessmentSchema),
    defaultValues: {
      assessedOn: formatKstDate(),
      kind: hasInitial ? ("REASSESS" as const) : ("INITIAL" as const),
      note: "",
    },
  });
  const {
    control,
    register,
    formState: { errors },
  } = form;

  const onSubmit = form.handleSubmit((values) =>
    add.mutate(values, {
      onSuccess: () => {
        toast.success("포괄평가를 기록했습니다");
        form.reset({ assessedOn: formatKstDate(), kind: "REASSESS", note: "" });
      },
    }),
  );

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="bg-muted/50 grid gap-3 rounded-md p-3 sm:grid-cols-[10rem_8rem_minmax(0,1fr)_auto] sm:items-end"
    >
      <FormField
        label="평가한 날"
        htmlFor="assessment-date"
        error={errors.assessedOn?.message}
      >
        <Controller
          control={control}
          name="assessedOn"
          render={({ field }) => (
            <DateInput
              id="assessment-date"
              max={formatKstDate()}
              aria-invalid={!!errors.assessedOn}
              {...field}
            />
          )}
        />
      </FormField>
      <FormField label="구분" htmlFor="assessment-kind">
        <Select id="assessment-kind" {...register("kind")}>
          {HOME_CARE_ASSESSMENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {HOME_CARE_ASSESSMENT_KIND_LABELS[kind]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label="메모"
        htmlFor="assessment-note"
        error={errors.note?.message}
      >
        <Input
          id="assessment-note"
          placeholder="선택"
          maxLength={200}
          {...register("note")}
        />
      </FormField>
      <Button type="submit" disabled={add.isPending}>
        기록
      </Button>
    </form>
  );
}
