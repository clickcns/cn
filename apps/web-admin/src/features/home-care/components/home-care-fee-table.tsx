import {
  CARE_GRADE_LABELS,
  HOME_CARE_FEE_VERDICT_LABELS,
  HOME_CARE_MONTHLY_VISITS,
  PROFESSION_LABELS,
  PROFESSIONS,
  type HomeCareFeeStatus,
  type HomeCareFeeVerdict,
  type HomeCareTally,
  type Profession,
  type Recipient,
} from "@repo/shared-types";
import { PlusIcon } from "lucide-react";
import { Link } from "react-router";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrganizationGroupedRows } from "@/features/organizations/components/organization-grouped-rows";
import { visitsHref } from "@/features/visits/lib/visits-href";
import { cn } from "@/lib/utils";

const COLUMN_COUNT = 2 + PROFESSIONS.length + 1;

const VERDICT_BADGE: Record<HomeCareFeeVerdict, BadgeVariant> = {
  SHORT: "destructive",
  PENDING: "warning",
  SECURED: "success",
};

type Status = HomeCareFeeStatus<Recipient>;

/**
 * 재택의료센터 수급자별 그달 기본료 판정 표. 직종 칸은 "확정/요건"과 지난 미확정·예정 건수,
 * 할 일 칸은 모자란 직종마다 [방문 잡기] 버튼(지난달이면 글로만)과 확정·남은 방문 안내다.
 * 운영자의 전체 기관 보기면 기관별로 묶는다.
 */
export function HomeCareFeeTable({
  statuses,
  month,
  closed,
  organizationNames,
  onSchedule,
}: {
  statuses: readonly Status[];
  month: string;
  /** 지난달: 방문을 더 잡을 수 없다 */
  closed: boolean;
  organizationNames: Map<string, string> | undefined;
  onSchedule: (recipient: Recipient, profession: Profession) => void;
}) {
  const renderRow = (status: Status) => (
    <FeeRow
      key={status.recipient.id}
      status={status}
      month={month}
      closed={closed}
      onSchedule={onSchedule}
    />
  );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>수급자</TableHead>
          {PROFESSIONS.map((profession) => (
            <TableHead key={profession}>
              {PROFESSION_LABELS[profession]}{" "}
              <span className="font-normal">
                {HOME_CARE_MONTHLY_VISITS[profession]}회
              </span>
            </TableHead>
          ))}
          <TableHead>판정</TableHead>
          <TableHead>할 일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {organizationNames ? (
          <OrganizationGroupedRows
            rows={statuses}
            groupOf={(status) => ({
              key: status.recipient.organizationId,
              label:
                organizationNames.get(status.recipient.organizationId) ??
                "기관",
            })}
            colSpan={COLUMN_COUNT}
            renderRow={renderRow}
            detail={(rows) =>
              `${rows.length}명 · 방문 부족 ${rows.filter((row) => row.verdict === "SHORT").length}명`
            }
          />
        ) : (
          statuses.map(renderRow)
        )}
      </TableBody>
    </Table>
  );
}

function FeeRow({
  status,
  month,
  closed,
  onSchedule,
}: {
  status: Status;
  month: string;
  closed: boolean;
  onSchedule: (recipient: Recipient, profession: Profession) => void;
}) {
  const { recipient, verdict } = status;
  return (
    <TableRow>
      <TableCell>
        <Link
          to={visitsHref({ view: "calendar", month, recipient: recipient.id })}
          className="hover:text-primary focus-visible:ring-ring/25 rounded font-medium outline-none hover:underline focus-visible:ring-3"
        >
          {recipient.name}
        </Link>
        {recipient.careGrade && (
          <span className="text-muted-foreground ml-2 text-xs">
            {CARE_GRADE_LABELS[recipient.careGrade]}
          </span>
        )}
      </TableCell>
      {PROFESSIONS.map((profession) => (
        <TableCell key={profession}>
          <TallyCell
            tally={status.tallies[profession]}
            required={HOME_CARE_MONTHLY_VISITS[profession]}
            missing={status.missing[profession]}
          />
        </TableCell>
      ))}
      <TableCell>
        <Badge variant={VERDICT_BADGE[verdict]}>
          {HOME_CARE_FEE_VERDICT_LABELS[verdict]}
        </Badge>
      </TableCell>
      <TableCell>
        <TodoCell status={status} closed={closed} onSchedule={onSchedule} />
      </TableCell>
    </TableRow>
  );
}

/** "확정 1/2"(확정으로 채우면 초록, 미확정·예정까지 더해 채우면 주황, 그래도 모자라면 빨강)와 남은 건수. */
function TallyCell({
  tally,
  required,
  missing,
}: {
  tally: HomeCareTally;
  required: number;
  /** 미확정·예정까지 더해도 모자란 수(판정에서 구한 값) */
  missing: number;
}) {
  const { confirmed, unconfirmedPast, upcoming } = tally;
  let tone = "text-warning";
  if (missing > 0) tone = "text-destructive";
  else if (confirmed >= required) tone = "text-success";
  const rest = [
    unconfirmedPast > 0 && `미확정 ${unconfirmedPast}`,
    upcoming > 0 && `예정 ${upcoming}`,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-0.5 tabular-nums">
      <span className={cn("text-sm font-semibold", tone)}>
        확정 {confirmed}/{required}
      </span>
      {rest.length > 0 && (
        <span className="text-muted-foreground text-xs">
          {rest.join(" · ")}
        </span>
      )}
    </div>
  );
}

function TodoCell({
  status,
  closed,
  onSchedule,
}: {
  status: Status;
  closed: boolean;
  onSchedule: (recipient: Recipient, profession: Profession) => void;
}) {
  const { recipient, missing, toConfirm, toVisit } = status;
  if (status.verdict === "SECURED") {
    return <span className="text-muted-foreground">—</span>;
  }
  const lacking = PROFESSIONS.filter((profession) => missing[profession] > 0);
  /** "간호사 1회" */
  const need = (profession: Profession) =>
    `${PROFESSION_LABELS[profession]} ${missing[profession]}회`;
  const notes = [
    toConfirm > 0 && `지난 방문 ${toConfirm}건 확정`,
    toVisit > 0 && `예정 방문 ${toVisit}건 마치기`,
  ].filter(Boolean);
  // 지난달은 방문을 더 잡을 수 없어 글로만 남긴다.
  const actions = closed
    ? lacking.length > 0 && (
        <span className="text-destructive text-sm">
          {lacking.map(need).join(" · ")} 모자람
        </span>
      )
    : lacking.map((profession) => (
        <Button
          key={profession}
          variant="outline"
          size="sm"
          aria-label={`${recipient.name} ${PROFESSION_LABELS[profession]} 방문 잡기(${missing[profession]}회 모자람)`}
          onClick={() => onSchedule(recipient, profession)}
        >
          <PlusIcon />
          {need(profession)}
        </Button>
      ));
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {actions}
      {notes.length > 0 && (
        <span className="text-muted-foreground text-xs">
          {notes.join(" · ")}
        </span>
      )}
    </div>
  );
}
