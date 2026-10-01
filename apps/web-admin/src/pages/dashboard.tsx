import {
  addKstDays,
  emptyStatusCounts,
  formatDateLabel,
  formatKstDate,
  monthOf,
  summarizeCalendarMonth,
  summarizeMonthStaff,
  totalCount,
  VISIT_STATUS_LABELS,
  VISIT_STATUSES,
  type VisitStatus,
} from "@repo/shared-types";
import {
  BanknoteIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  ClipboardXIcon,
} from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { OverdueVisitsCard } from "@/features/dashboard/components/overdue-visits-card";
import { RecipientMonthCard } from "@/features/dashboard/components/recipient-month-card";
import { StaffMonthCard } from "@/features/dashboard/components/staff-month-card";
import { StatCard } from "@/features/dashboard/components/stat-card";
import {
  OVERDUE_ROWS,
  OVERDUE_STATUSES,
} from "@/features/dashboard/lib/overdue";
import { recipientChecks } from "@/features/dashboard/lib/recipient-checks";
import {
  useOrganizationColumnNames,
  useScopeOrganizationId,
} from "@/features/organizations/hooks/use-organization-scope";
import { useMonthVisits } from "@/features/visits/hooks/use-month-visits";
import { useVisitPage } from "@/features/visits/hooks/use-visits";
import { visitsHref } from "@/features/visits/lib/visits-href";
import { wonToManwon } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

/** "예정 0 · 작성 중 1 · 확정 2" */
function formatStatusCounts(
  counts: Record<VisitStatus, number>,
  statuses: readonly VisitStatus[] = VISIT_STATUSES,
) {
  return statuses
    .map((status) => `${VISIT_STATUS_LABELS[status]} ${counts[status]}`)
    .join(" · ");
}

/**
 * 운영 현황판(관리 웹 첫 화면): 오늘 방문, 확정 안 된 지난 방문, 이달 방문과 직원별 현황,
 * 재택의료 기본료 위험과 이달 방문 없는 수급자. 방문 목록·달력·수급자 API를 그대로 쓴다.
 */
export default function DashboardPage() {
  const today = formatKstDate();
  const month = monthOf(today);
  const organizationId = useScopeOrganizationId();
  // 운영자가 "전체 기관"을 볼 때만 있다. 표를 기관별로 묶거나 기관 칸을 더한다.
  const organizationNames = useOrganizationColumnNames();

  // 이달 방문(날짜별 건수 + 가벼운 목록)과 수급자. [방문 달력]으로 가면 받은 것을 그대로 쓴다
  // ([재택의료 수입]은 금액 셈에 서식 값이 필요해 따로 받는다). 요약은 모두 이달 안만 센다.
  const { calendar, visits, recipients, calendarError, error, retry } =
    useMonthVisits(month);
  // 어제까지의 미확정 방문: 오래된 앞의 몇 건과 상태별 건수(statusCounts).
  const overdueQuery = useVisitPage({
    to: addKstDays(today, -1),
    status: [...OVERDUE_STATUSES],
    organizationId,
    pageSize: OVERDUE_ROWS,
  });
  const monthSummary = useMemo(
    () => summarizeCalendarMonth(calendar?.days ?? [], month, today),
    [calendar, month, today],
  );
  const todayCounts =
    calendar?.days.find((day) => day.date === today)?.counts ??
    emptyStatusCounts();

  const staffSummaries = useMemo(
    () => (visits == null ? visits : summarizeMonthStaff(visits, month, today)),
    [visits, month, today],
  );
  const checks = useMemo(
    () =>
      visits == null
        ? visits
        : recipients && recipientChecks(visits, recipients, month, today),
    [visits, recipients, month, today],
  );
  let feeDetail: string | undefined;
  if (checks === null) feeDetail = "기관을 골라 주세요";
  else if (checks?.homeCare.length === 0) {
    feeDetail = "재택의료센터 수급자가 없습니다";
  } else if (checks) {
    const { SHORT, PENDING } = checks.feeTotals;
    feeDetail = `방문 부족 ${SHORT.count}명 · 확정 남음 ${PENDING.count}명 / ${checks.homeCare.length}명`;
  }

  const overdue = overdueQuery.data;
  const confirmedRate =
    monthSummary.total > 0
      ? Math.round((monthSummary.counts.CONFIRMED / monthSummary.total) * 100)
      : null;

  return (
    <>
      <PageHeader
        title="현황판"
        description={`${formatDateLabel(today)} 기준 오늘 방문, 확정 안 된 기록, 이달 방문 현황입니다.`}
      />

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="오늘 방문"
            icon={CalendarCheckIcon}
            value={calendar ? totalCount(todayCounts) : undefined}
            unit="건"
            detail={calendar && formatStatusCounts(todayCounts)}
            link={{
              to: visitsHref({ from: today, to: today }),
              label: "오늘 방문 목록",
            }}
          />
          <StatCard
            label="확정 안 된 지난 방문"
            icon={ClipboardXIcon}
            value={overdue?.total}
            unit="건"
            tone={overdue?.total ? "warning" : "success"}
            detail={
              overdue &&
              formatStatusCounts(overdue.statusCounts, OVERDUE_STATUSES)
            }
          />
          <StatCard
            label={`${Number(month.slice(5))}월 방문`}
            icon={CalendarDaysIcon}
            value={calendar ? monthSummary.total : undefined}
            unit="건"
            detail={
              calendar &&
              `확정 ${monthSummary.counts.CONFIRMED}${confirmedRate === null ? "" : `(${confirmedRate}%)`} · 남은 예정 ${monthSummary.counts.SCHEDULED}`
            }
            link={{
              to: visitsHref({ view: "calendar", month }),
              label: "방문 달력",
            }}
          />
          <StatCard
            label="재택의료 기본료 위험"
            icon={BanknoteIcon}
            value={
              checks ? wonToManwon(checks.feeTotals.SHORT.amount) : undefined
            }
            unit="만원"
            tone={checks?.feeTotals.SHORT.count ? "warning" : "success"}
            detail={feeDetail}
            link={{ to: ROUTES.homeCare, label: "재택의료 수입" }}
          />
        </div>

        <OverdueVisitsCard
          page={overdue}
          error={overdueQuery.error}
          onRetry={() => void overdueQuery.refetch()}
          today={today}
          organizationNames={organizationNames}
        />

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <StaffMonthCard
            month={month}
            summaries={staffSummaries}
            error={calendarError}
            onRetry={retry}
            organizationNames={organizationNames}
          />
          <RecipientMonthCard
            month={month}
            checks={checks}
            error={error}
            onRetry={retry}
            organizationNames={organizationNames}
          />
        </div>
      </div>
    </>
  );
}
