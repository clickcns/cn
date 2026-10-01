import { zodResolver } from "@hookform/resolvers/zod";
import {
  formatKstDate,
  HOME_CARE_DEATH_FEE_RATE,
  HOME_CARE_END_REASON_LABELS,
  HOME_CARE_END_REASONS,
  SetHomeCareEndSchema,
  type HomeCareCase,
  type SetHomeCareEndInput,
} from "@repo/shared-types";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/data-state";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { AssessmentSection } from "@/features/home-care/components/assessment-section";
import { CaseSection } from "@/features/home-care/components/case-section";
import { ExternalServiceSection } from "@/features/home-care/components/external-service-section";
import {
  useHomeCareCase,
  useHomeCareCaseMutation,
  useRefreshHomeCareMonths,
} from "@/features/home-care/hooks/use-home-care-case";
import { api } from "@/lib/api";
import { formatYearDate } from "@/lib/format";

/**
 * 재택의료 사례 정보 창: 포괄평가 기록, 다른 기관 서비스 일정, 재택의료 종결. 창을 닫으면 그사이
 * 고친 내용으로 재택의료 수입의 판정·금액을 다시 받는다. recipient가 null이면 닫힌 창이다.
 */
export function HomeCareCaseDialog({
  recipient,
  onClose,
}: {
  recipient: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const refreshHomeCareMonths = useRefreshHomeCareMonths();
  return (
    <Dialog
      open={recipient !== null}
      onOpenChange={(open) => {
        if (open) return;
        refreshHomeCareMonths();
        onClose();
      }}
    >
      <DialogContent size="lg">
        {recipient && <CaseBody key={recipient.id} recipient={recipient} />}
      </DialogContent>
    </Dialog>
  );
}

function CaseBody({ recipient }: { recipient: { id: string; name: string } }) {
  const caseQuery = useHomeCareCase(recipient.id);
  const homeCareCase = caseQuery.data;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{recipient.name} 재택의료 사례 정보</DialogTitle>
        <DialogDescription>
          포괄평가·다른 기관 서비스·종결은 그달 기본료 판정과 예상 금액에
          반영됩니다(창을 닫으면 다시 계산).
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-7">
        {caseQuery.isError ? (
          <ErrorState
            error={caseQuery.error}
            title="사례 정보를 불러오지 못했습니다"
            onRetry={() => void caseQuery.refetch()}
          />
        ) : !homeCareCase ? (
          <LoadingState />
        ) : (
          <>
            <AssessmentSection
              recipientId={recipient.id}
              assessments={homeCareCase.assessments}
            />
            <ExternalServiceSection
              recipientId={recipient.id}
              services={homeCareCase.externalServices}
            />
            <EndSection
              recipientId={recipient.id}
              homeCareCase={homeCareCase}
            />
          </>
        )}
      </DialogBody>
    </>
  );
}

/** 재택의료 종결: 종결했으면 날짜·사유와 [종결 취소], 아니면 날짜·사유를 적는다. */
function EndSection({
  recipientId,
  homeCareCase,
}: {
  recipientId: string;
  homeCareCase: HomeCareCase;
}) {
  const save = useHomeCareCaseMutation(
    recipientId,
    (input: SetHomeCareEndInput) =>
      api.recipients.setHomeCareEnd(recipientId, input),
  );
  const { homeCareEndedOn: endedOn, homeCareEndReason: endReason } =
    homeCareCase;

  return (
    <CaseSection
      title="재택의료 종결"
      description={`종결한 달은 종결일까지 요건을 세고, 그 뒤 달에는 재택의료 수입에 나오지 않습니다. 사망으로 종결한 달에 팀이 방문한 적이 있으면 요건을 못 채워도 기본료의 ${HOME_CARE_DEATH_FEE_RATE * 100}%를 셉니다.`}
    >
      {endedOn && endReason ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
          <span className="text-sm">
            <span className="font-medium">{formatYearDate(endedOn)}</span> 종결
            · {HOME_CARE_END_REASON_LABELS[endReason]}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { endedOn: null, reason: null },
                { onSuccess: () => toast.success("종결을 취소했습니다") },
              )
            }
          >
            종결 취소
          </Button>
        </div>
      ) : (
        <EndForm
          onSubmit={(input) =>
            save.mutate(input, {
              onSuccess: () => toast.success("종결로 적었습니다"),
            })
          }
          pending={save.isPending}
        />
      )}
    </CaseSection>
  );
}

function EndForm({
  onSubmit,
  pending,
}: {
  onSubmit: (input: SetHomeCareEndInput) => void;
  pending: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(SetHomeCareEndSchema),
    defaultValues: { endedOn: formatKstDate(), reason: "DEATH" as const },
  });
  const {
    control,
    register,
    formState: { errors },
  } = form;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-3 sm:grid-cols-[10rem_12rem_auto] sm:items-start"
    >
      <FormField
        label="종결한 날"
        htmlFor="home-care-end-date"
        error={errors.endedOn?.message}
      >
        <Controller
          control={control}
          name="endedOn"
          render={({ field }) => (
            <DateInput
              id="home-care-end-date"
              aria-invalid={!!errors.endedOn}
              {...field}
              value={field.value ?? ""}
            />
          )}
        />
      </FormField>
      <FormField
        label="사유"
        htmlFor="home-care-end-reason"
        error={errors.reason?.message}
      >
        <Select id="home-care-end-reason" {...register("reason")}>
          {HOME_CARE_END_REASONS.map((option) => (
            <option key={option} value={option}>
              {HOME_CARE_END_REASON_LABELS[option]}
            </option>
          ))}
        </Select>
      </FormField>
      <Button
        type="submit"
        variant="destructive-outline"
        className="sm:mt-6"
        disabled={pending}
      >
        종결 저장
      </Button>
    </form>
  );
}
