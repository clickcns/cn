import {
  formatKstDate,
  PROFESSION_LABELS,
  PROGRAM_LABELS,
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
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import type { VisitListLinkState } from "@/features/visits/hooks/use-visit-list-href";
import { formatCareGrade, formatDateTime, orDash } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

interface VisitTableProps {
  visits: VisitSummary[];
  /** 운영자가 전체 기관을 볼 때 기관 이름을 보여 준다. */
  organizationNames?: Map<string, string>;
}

export function VisitTable({ visits, organizationNames }: VisitTableProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const today = formatKstDate();
  // 상세 화면의 "방문 기록" 링크가 지금 필터로 돌아오게 한다.
  const linkState: VisitListLinkState = { listSearch: location.search };

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>방문 일시</TableHead>
          <TableHead>수급자</TableHead>
          {organizationNames && <TableHead>기관</TableHead>}
          <TableHead>등급</TableHead>
          <TableHead>사업</TableHead>
          <TableHead>담당자</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>확정 일시</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visits.map((visit) => (
          <TableRow
            key={visit.id}
            className="hover:bg-primary-soft/50 cursor-pointer"
            onClick={(event) => {
              // 이름 링크를 누른 경우는 링크가 이동을 맡는다.
              if ((event.target as HTMLElement).closest("a")) return;
              navigate(ROUTES.visitDetail(visit.id), { state: linkState });
            }}
          >
            <TableCell className="whitespace-nowrap">
              <span className="inline-flex items-center gap-2">
                {formatDateTime(visit.scheduledAt)}
                {formatKstDate(new Date(visit.scheduledAt)) === today && (
                  <Badge variant="primary" className="h-5 px-1.5 text-[11px]">
                    오늘
                  </Badge>
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
            {organizationNames && (
              <TableCell>
                {orDash(organizationNames.get(visit.organizationId))}
              </TableCell>
            )}
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
        ))}
      </TableBody>
    </Table>
  );
}
