import {
  formatVitalChange,
  formatVitalValue,
  RECORD_HISTORY_MAX_LIMIT,
  vitalChangeLabel,
  vitalSummary,
  vitalTrends,
  type VisitDetail,
  type VitalPoint,
  type VitalTrend,
} from "@repo/shared-types";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { usePastRecords } from "@/features/past-records/hooks/use-past-records";
import { formatDateLabel } from "@/lib/date";

const VitalsChart = lazy(
  () => import("@/features/vitals/components/vitals-chart"),
);

/** 표에 처음 보이는 줄 수(최근부터) */
const ROWS = 5;

function pointDate(point: VitalPoint): string {
  if (point.current) return "이번 방문";
  return `${formatDateLabel(point.date)}${point.draft ? " (작성 중)" : ""}`;
}

/** 활력징후 하나: 최근 값과 지난번 대비, 그래프(점이 둘 이상), 날짜별 표 */
function VitalSection({ trend }: { trend: VitalTrend }) {
  const [showAll, setShowAll] = useState(false);
  const { sign } = trend;
  const latest = trend.points.at(-1)!;
  const change = formatVitalChange(latest.change);
  const rows = [...trend.points].reverse();
  const shown = showAll ? rows : rows.slice(0, ROWS);

  return (
    <section
      aria-label={sign.label}
      className="flex flex-col gap-2 border-t pt-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="font-bold">{sign.label}</h3>
        <p className="tabular-nums">
          <span className="font-semibold">
            {formatVitalValue(sign, latest.values)}
          </span>
          {change && (
            <span className="text-muted-foreground ml-2 text-sm" aria-hidden>
              {change}
            </span>
          )}
          <span className="sr-only">
            {vitalChangeLabel(sign, latest.change)}
          </span>
        </p>
      </div>
      {sign.fields.length > 1 && (
        <p className="text-muted-foreground text-xs" aria-hidden>
          실선 {sign.fields[0]!.label} · 점선 {sign.fields[1]!.label}
        </p>
      )}
      {trend.points.length > 1 && (
        <Suspense
          fallback={<div className="bg-muted h-24 animate-pulse rounded-lg" />}
        >
          <VitalsChart trend={trend} />
        </Suspense>
      )}
      <table className="w-full text-sm tabular-nums">
        <thead className="sr-only">
          <tr>
            <th>날짜</th>
            <th>값</th>
            <th>지난번 대비</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((point) => (
            <tr key={point.recordId} className="border-border/60 border-t">
              <td className="text-muted-foreground py-1.5 pr-2">
                {pointDate(point)}
              </td>
              <td className="py-1.5 text-right font-medium">
                {formatVitalValue(sign, point.values)}
              </td>
              <td className="text-muted-foreground py-1.5 pl-2 text-right">
                {formatVitalChange(point.change) ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > ROWS && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start px-3"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? `최근 ${ROWS}회만` : `${rows.length}회 모두 보기`}
        </Button>
      )}
    </section>
  );
}

/**
 * 활력징후 추이: 지난 기록(간호 서식)에 적힌 값과 지난번과의 차이만 — 정상·이상 판단은 하지 않는다.
 * 지난 기록 카드와 같은 쿼리를 쓰고(요청을 늘리지 않음), [이전 기록 더 보기]로 30건까지 더 받는다.
 * 확정한 방문이면 이번 값을 마지막 점으로. 값이 없으면 숨긴다.
 */
export function VitalsTrendCard({ visit }: { visit: VisitDetail }) {
  const recordsQuery = usePastRecords(visit);
  const records = recordsQuery.data;
  // 작성 중에는 늘 undefined라 저장할 때마다 다시 셈하지 않는다(확정한 방문만 이번 값을 점으로)
  const current = visit.status === "CONFIRMED" ? visit : undefined;
  if (!records) return null;
  const trends = vitalTrends(records, current);
  const summary = vitalSummary(trends);
  if (!summary) return null;

  const canLoadMore =
    recordsQuery.hasNextPage && records.length < RECORD_HISTORY_MAX_LIMIT;

  return (
    <CollapsibleCard
      title="활력징후 추이"
      storageKey="carenote:vitals-expanded"
      summary={
        <p className="text-muted-foreground">
          {summary.current
            ? "이번 방문"
            : `최근 측정 ${formatDateLabel(summary.date)}`}
          :{" "}
          <span className="text-foreground tabular-nums">
            {summary.latest
              .map(
                ({ sign, point }) =>
                  `${sign.label} ${formatVitalValue(sign, point.values)}`,
              )
              .join(" · ")}
          </span>
        </p>
      }
    >
      {trends.map((trend) => (
        <VitalSection key={trend.sign.id} trend={trend} />
      ))}
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <span>
          지난 기록 {records.length}건 중 측정 {summary.measured}회 · 기록된
          값입니다
        </span>
        {canLoadMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={recordsQuery.isFetchingNextPage}
            onClick={() => void recordsQuery.fetchNextPage()}
          >
            이전 기록 더 보기
          </Button>
        )}
      </div>
    </CollapsibleCard>
  );
}
