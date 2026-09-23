import { formatKstDate, FORMS, type VisitDetail } from "@repo/shared-types";
import { Lock } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormHeading, FormView } from "@/features/forms/components/form-view";
import { getVisitDate } from "@/features/visits/lib/record-form";
import {
  formatDateTimeLabel,
  formatTimeLabel,
  minutesBetween,
} from "@/lib/date";

const EMPTY = "—";

/**
 * 방문 시간. 예정일과 다른 날 시작했거나 자정을 넘겨 끝났으면 날짜까지 보여 준다.
 * 예: "9월 23일 (수) 23:40 ~ 9월 24일 (목) 00:20 · 40분"
 */
function VisitTimeText({ visit }: { visit: VisitDetail }) {
  const { startedAt, endedAt } = visit;
  if (!startedAt && !endedAt) {
    return <p className="text-muted-foreground">기록된 시각이 없습니다</p>;
  }
  const scheduledDate = getVisitDate(visit);
  const startDate = startedAt ? formatKstDate(new Date(startedAt)) : null;
  const endDate = endedAt ? formatKstDate(new Date(endedAt)) : null;
  // 시작 시각이 없으면 예정일을 기준으로 삼는다.
  const baseDate = startDate ?? scheduledDate;
  const withDate =
    baseDate !== scheduledDate || (endDate !== null && endDate !== baseDate);

  const format = (iso: string | null) => {
    if (!iso) return EMPTY;
    return withDate ? formatDateTimeLabel(iso) : formatTimeLabel(iso);
  };
  const duration =
    startedAt && endedAt ? minutesBetween(startedAt, endedAt) : null;

  return (
    <p className="text-lg font-semibold tabular-nums">
      <span className="whitespace-nowrap">{format(startedAt)}</span>
      {" ~ "}
      <span className="whitespace-nowrap">{format(endedAt)}</span>
      {duration !== null && (
        <span className="text-muted-foreground font-normal whitespace-nowrap">
          {" · "}
          {duration}분
        </span>
      )}
    </p>
  );
}

/** 읽기 전용 방문 기록. 확정된 방문이거나, 담당자가 아닌 사람이 볼 때 쓴다. */
export function VisitRecordView({ visit }: { visit: VisitDetail }) {
  const isConfirmed = visit.status === "CONFIRMED";

  return (
    <div className="flex flex-col gap-4">
      <div className="border-success/20 bg-success-soft text-success flex items-start gap-3 rounded-2xl border px-5 py-4">
        <Lock className="mt-0.5 size-5 shrink-0" />
        <p className="font-semibold">
          {isConfirmed
            ? "확정된 기록입니다. 더 이상 수정할 수 없습니다."
            : `담당자(${visit.staff.name})만 기록을 작성할 수 있습니다.`}
          {isConfirmed && visit.confirmedAt && (
            <span className="block font-normal">
              확정 시각: {formatDateTimeLabel(visit.confirmedAt)}
            </span>
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>방문 시간</CardTitle>
        </CardHeader>
        <VisitTimeText visit={visit} />
      </Card>

      {visit.formIds.map((formId) => (
        <section key={formId} className="flex flex-col gap-4">
          <FormHeading form={FORMS[formId]} />
          <FormView form={FORMS[formId]} data={visit.forms[formId]} />
        </section>
      ))}
    </div>
  );
}
