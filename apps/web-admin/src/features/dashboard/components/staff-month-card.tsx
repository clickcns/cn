import {
  PROFESSION_LABELS,
  totalCount,
  VISIT_STATUS_LABELS,
  type MonthStaffSummary,
} from "@repo/shared-types";
import { CalendarXIcon, UsersRoundIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardCardHeader } from "@/features/dashboard/components/dashboard-card";
import { MonthFallback } from "@/features/dashboard/components/month-fallback";
import { visitsHref } from "@/features/visits/lib/visits-href";
import { orDash } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 직원별 이달 방문: 상태별 건수와 이달 방문 중 오늘 전인데 확정하지 않은 방문 수.
 * 누르면 방문 달력이 그 담당자 방문만 보여 준다. 이달 방문이 있는 담당자만 나온다.
 */
export function StaffMonthCard({
  month,
  summaries,
  error,
  onRetry,
  organizationNames,
}: {
  month: string;
  /** undefined는 받는 중, null은 방문이 너무 많아 목록이 없음 */
  summaries: MonthStaffSummary[] | null | undefined;
  error: unknown;
  onRetry: () => void;
  organizationNames: Map<string, string> | undefined;
}) {
  const navigate = useNavigate();
  const monthNumber = Number(month.slice(5));

  return (
    <Card>
      <DashboardCardHeader
        icon={UsersRoundIcon}
        title={`직원별 ${monthNumber}월 방문`}
        count={summaries ? `${summaries.length}명` : undefined}
        description="이달 지난 미확정은 이달 방문 중 오늘 전인데 기록을 확정하지 않은 것입니다. 이름을 누르면 그 직원의 방문 달력을 봅니다."
      />
      {summaries == null ? (
        <MonthFallback
          tooMany={summaries === null}
          error={error}
          onRetry={onRetry}
        />
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={CalendarXIcon}
          title={`${monthNumber}월 방문이 없습니다`}
          className="py-10"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>담당자</TableHead>
              {organizationNames && <TableHead>기관</TableHead>}
              <TableHead className="text-right">방문</TableHead>
              <TableHead className="text-right">
                {VISIT_STATUS_LABELS.CONFIRMED}
              </TableHead>
              <TableHead className="text-right">
                {VISIT_STATUS_LABELS.DRAFT}
              </TableHead>
              <TableHead className="text-right">
                {VISIT_STATUS_LABELS.SCHEDULED}
              </TableHead>
              <TableHead className="text-right">이달 지난 미확정</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((summary) => {
              const href = visitsHref({
                view: "calendar",
                month,
                staffId: summary.staff.id,
              });
              return (
                <TableRow
                  key={summary.staff.id}
                  className="hover:bg-primary-soft/50 cursor-pointer"
                  onClick={(event) => {
                    // 이름 링크를 누른 경우는 링크가 이동을 맡는다.
                    if ((event.target as HTMLElement).closest("a")) return;
                    navigate(href);
                  }}
                >
                  <TableCell className="whitespace-nowrap">
                    <Link
                      to={href}
                      className="hover:text-primary font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                    >
                      {summary.staff.name}
                    </Link>
                    {summary.staff.profession && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {PROFESSION_LABELS[summary.staff.profession]}
                      </span>
                    )}
                    {!summary.staff.isActive && (
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        (사용 중지)
                      </span>
                    )}
                  </TableCell>
                  {organizationNames && (
                    <TableCell className="whitespace-nowrap">
                      {orDash(organizationNames.get(summary.organizationId))}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {totalCount(summary.counts)}
                  </TableCell>
                  <TableCell className="text-success text-right">
                    {summary.counts.CONFIRMED}
                  </TableCell>
                  <TableCell className="text-right">
                    {summary.counts.DRAFT}
                  </TableCell>
                  <TableCell className="text-right">
                    {summary.counts.SCHEDULED}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      summary.overdue > 0
                        ? "text-warning font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {summary.overdue}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
