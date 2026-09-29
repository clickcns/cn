import {
  daysBetween,
  formatKstDate,
  PROFESSION_LABELS,
  PROGRAM_LABELS,
  type VisitOrganizationCount,
  type VisitSummary,
} from "@repo/shared-types";
import { Link, useLocation, useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrganizationGroupedRows } from "@/features/organizations/components/organization-grouped-rows";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import type { VisitListLinkState } from "@/features/visits/hooks/use-visit-list-href";
import { formatCareGrade, formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

const COLUMN_COUNT = 7;

interface VisitTableProps {
  visits: VisitSummary[];
  /** 운영자가 전체 기관을 볼 때: 방문을 기관별로 묶는다(다른 목록과 같다). */
  organizationNames?: Map<string, string>;
  /**
   * 기관별 건수(목록 groupBy=organization 응답). 묶음 머리 줄에 조건 전체 기준 건수를 보여 준다.
   * 없으면 받은 행 수를 쓴다.
   */
  organizationCounts?: ReadonlyMap<string, VisitOrganizationCount>;
  /** 있으면 행을 눌렀을 때 상세로 가지 않고 이 함수를 부른다(달력의 빠른 보기). */
  onRowClick?: (visit: VisitSummary) => void;
}

export function VisitTable({
  visits,
  organizationNames,
  organizationCounts,
  onRowClick,
}: VisitTableProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const today = formatKstDate();
  // 상세 화면의 "방문 기록" 링크가 지금 필터로 돌아오게 한다.
  const linkState: VisitListLinkState = { listSearch: location.search };

  const renderRow = (visit: VisitSummary) => {
    const date = formatKstDate(new Date(visit.scheduledAt));
    return (
      <TableRow
        key={visit.id}
        className="hover:bg-primary-soft/50 cursor-pointer"
        onClick={(event) => {
          // 이름 링크를 누른 경우는 링크가 이동을 맡는다.
          if ((event.target as HTMLElement).closest("a")) return;
          if (onRowClick) onRowClick(visit);
          else navigate(ROUTES.visitDetail(visit.id), { state: linkState });
        }}
      >
        <TableCell className="whitespace-nowrap">
          <span className="inline-flex items-center gap-2">
            {formatDateTime(visit.scheduledAt)}
            {date === today ? (
              <Badge variant="primary" className="h-5 px-1.5 text-[11px]">
                오늘
              </Badge>
            ) : (
              // 지났는데 확정하지 않은 방문(현황판의 "확정 안 된 지난 방문"과 같은 기준)
              date < today &&
              visit.status !== "CONFIRMED" && (
                <span className="text-warning text-xs font-medium">
                  {daysBetween(date, today)}일 지남
                </span>
              )
            )}
          </span>
        </TableCell>
        <TableCell>
          <Link
            to={ROUTES.visitDetail(visit.id)}
            state={linkState}
            className="hover:text-primary font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {visit.recipient.name}
          </Link>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {formatCareGrade(visit.recipient.careGrade)}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {PROGRAM_LABELS[visit.program]}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {visit.staff.name}
          {visit.staff.profession && (
            <span className="text-muted-foreground">
              {" "}
              · {PROFESSION_LABELS[visit.staff.profession]}
            </span>
          )}
        </TableCell>
        <TableCell>
          <VisitStatusBadge status={visit.status} />
        </TableCell>
        <TableCell className="text-muted-foreground whitespace-nowrap">
          {formatDateTime(visit.confirmedAt)}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>방문 일시</TableHead>
          <TableHead>수급자</TableHead>
          <TableHead>등급</TableHead>
          <TableHead>사업</TableHead>
          <TableHead>담당자</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>확정 일시</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {organizationNames ? (
          <OrganizationGroupedRows
            rows={visits}
            groupOf={(visit) => ({
              key: visit.organizationId,
              label: organizationNames.get(visit.organizationId) ?? "기관",
            })}
            colSpan={COLUMN_COUNT}
            renderRow={renderRow}
            detail={(rows, key) => {
              const count = organizationCounts?.get(key);
              if (!count) return `${rows.length}건`;
              // "더 보기" 전이라 일부만 받았으면 받은 건수도 알린다.
              const shown =
                rows.length < count.total ? ` · ${rows.length}건 표시` : "";
              return `${count.total}건 · 확정 ${count.statusCounts.CONFIRMED}건${shown}`;
            }}
          />
        ) : (
          visits.map(renderRow)
        )}
      </TableBody>
    </Table>
  );
}
