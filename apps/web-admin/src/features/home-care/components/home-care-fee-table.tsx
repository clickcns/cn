import {
  CARE_GRADE_LABELS,
  HOME_CARE_END_REASON_LABELS,
  HOME_CARE_FEE_VERDICT_LABELS,
  HOME_CARE_MONTHLY_VISITS,
  HOME_CARE_REVENUE_PART_INFO,
  HOME_CARE_REVENUE_PARTS,
  isFeeAtRisk,
  PROFESSION_LABELS,
  PROFESSIONS,
  type HomeCareFeeStatus,
  type HomeCareFeeVerdict,
  type HomeCareRecipient,
  type HomeCareRevenue,
  type HomeCareTally,
  type Profession,
} from "@repo/shared-types";
import { ClipboardCheckIcon, ClipboardListIcon, PlusIcon } from "lucide-react";
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
import { WarningList } from "@/components/ui/warning-list";
import { OrganizationGroupedRows } from "@/features/organizations/components/organization-grouped-rows";
import { visitsHref } from "@/features/visits/lib/visits-href";
import {
  formatNumber,
  formatShortDate,
  formatWon,
  wonToManwon,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const COLUMN_COUNT = 1 + PROFESSIONS.length + 3;

const VERDICT_BADGE: Record<HomeCareFeeVerdict, BadgeVariant> = {
  BLOCKED: "destructive",
  SHORT: "destructive",
  PENDING: "warning",
  SECURED: "success",
};

type Status = HomeCareFeeStatus<HomeCareRecipient>;
type Schedule = (recipient: HomeCareRecipient, profession: Profession) => void;
type OpenCase = (recipient: HomeCareRecipient) => void;

/**
 * 재택의료센터 수급자별 그달 기본료 판정과 예상 금액 표. 수급자 칸은 포괄평가·종결과 [사례 정보],
 * 직종 칸은 "확정/요건"과 지난 미확정·예정 건수, 할 일 칸은 모자란 직종마다 [방문 잡기] 버튼(지난달·
 * 종결이면 글로만)·포괄평가가 필요하면 [포괄평가 기록]과 확정·남은 방문 안내, 그 아래 판정·금액에서
 * 알아 둘 것이다. 운영자의 전체 기관 보기면 기관별로 묶는다.
 */
export function HomeCareFeeTable({
  statuses,
  revenues,
  month,
  closed,
  organizationNames,
  onSchedule,
  onOpenCase,
}: {
  statuses: readonly Status[];
  /** 수급자 id → 예상 수입 */
  revenues: ReadonlyMap<string, HomeCareRevenue>;
  month: string;
  /** 지난달: 방문을 더 잡을 수 없다 */
  closed: boolean;
  organizationNames: Map<string, string> | undefined;
  onSchedule: Schedule;
  onOpenCase: OpenCase;
}) {
  const renderRow = (status: Status) => (
    <FeeRow
      key={status.recipient.id}
      status={status}
      revenue={revenues.get(status.recipient.id)}
      month={month}
      closed={closed}
      onSchedule={onSchedule}
      onOpenCase={onOpenCase}
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
          <TableHead>예상 금액</TableHead>
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
            detail={(rows) => {
              const short = rows.filter((row) => isFeeAtRisk(row.verdict));
              const total = rows.reduce(
                (sum, row) =>
                  sum + (revenues.get(row.recipient.id)?.total ?? 0),
                0,
              );
              return `${rows.length}명 · 기본료 위험 ${short.length}명 · 예상 ${formatWon(total)}`;
            }}
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
  revenue,
  month,
  closed,
  onSchedule,
  onOpenCase,
}: {
  status: Status;
  revenue: HomeCareRevenue | undefined;
  month: string;
  closed: boolean;
  onSchedule: Schedule;
  onOpenCase: OpenCase;
}) {
  const { recipient, verdict } = status;
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-start gap-1">
          <div className="grid gap-0.5">
            <span>
              <Link
                to={visitsHref({
                  view: "calendar",
                  month,
                  recipient: recipient.id,
                })}
                className="hover:text-primary focus-visible:ring-ring/25 rounded font-medium outline-none hover:underline focus-visible:ring-3"
              >
                {recipient.name}
              </Link>
              {recipient.careGrade && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {CARE_GRADE_LABELS[recipient.careGrade]}
                </span>
              )}
            </span>
            <CaseLine status={status} />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mt-1"
            aria-label={`${recipient.name} 사례 정보(포괄평가·다른 기관 서비스·종결)`}
            title="사례 정보"
            onClick={() => onOpenCase(recipient)}
          >
            <ClipboardListIcon />
          </Button>
        </div>
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
      <TableCell>{revenue && <AmountCell revenue={revenue} />}</TableCell>
      <TableCell>
        <TodoCell
          status={status}
          issues={revenue?.issues ?? []}
          closed={closed}
          onSchedule={onSchedule}
          onOpenCase={onOpenCase}
        />
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
      <span className={cn("text-sm font-semibold whitespace-nowrap", tone)}>
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

/** "331,490원", 그 아래 항목별 만원("기본 14 · 진료 13.2")과 기본료 연속 개월. */
function AmountCell({ revenue }: { revenue: HomeCareRevenue }) {
  const parts = HOME_CARE_REVENUE_PARTS.filter(
    (part) => revenue.parts[part].amount > 0,
  );
  return (
    <div className="flex flex-col gap-0.5 whitespace-nowrap tabular-nums">
      <span
        className={cn(
          "text-sm font-semibold",
          revenue.total === 0 && "text-muted-foreground",
        )}
      >
        {formatWon(revenue.total)}
      </span>
      {parts.length > 0 && (
        <span className="text-muted-foreground text-xs">
          {parts
            .map(
              (part) =>
                `${HOME_CARE_REVENUE_PART_INFO[part].short} ${formatNumber(wonToManwon(revenue.parts[part].amount))}`,
            )
            .join(" · ")}
          만
        </span>
      )}
      {revenue.streak > 0 && (
        <span className="text-muted-foreground text-xs">
          연속 {revenue.streak}개월
        </span>
      )}
    </div>
  );
}

/** 수급자 이름 아래 한 줄: 종결, 포괄평가 미기록, 마지막 포괄평가와 재평가 기한. */
function CaseLine({ status }: { status: Status }) {
  const { period } = status;
  let text = "최초 포괄평가 전";
  let tone = "text-destructive";
  if (period.ended) {
    text = `${formatShortDate(period.ended.on)} ${HOME_CARE_END_REASON_LABELS[period.ended.reason]} 종결`;
    tone = "text-muted-foreground";
  } else if (period.assessment) {
    text = `평가 ${formatShortDate(period.assessment.assessedOn)} · 재평가 ${formatShortDate(period.assessment.deadline)}까지`;
    tone =
      period.block === "LAPSED" ? "text-destructive" : "text-muted-foreground";
  } else if (!period.block) {
    text = "포괄평가 미기록";
    tone = "text-warning";
  }
  return (
    <span className={cn("text-xs whitespace-nowrap tabular-nums", tone)}>
      {text}
    </span>
  );
}

/** 판정의 할 일(방문 잡기·확정 안내·포괄평가)과 그 아래 판정·금액에서 알아 둘 것. 둘 다 없으면 "—". */
function TodoCell({
  status,
  issues,
  closed,
  onSchedule,
  onOpenCase,
}: {
  status: Status;
  issues: readonly string[];
  closed: boolean;
  onSchedule: Schedule;
  onOpenCase: OpenCase;
}) {
  const notes = [...status.notes, ...issues];
  if (status.verdict === "SECURED" && notes.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {status.verdict === "BLOCKED" ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onOpenCase(status.recipient)}
        >
          <ClipboardCheckIcon />
          포괄평가 기록
        </Button>
      ) : (
        status.verdict !== "SECURED" && (
          <VerdictTodo
            status={status}
            canSchedule={!closed && !status.period.ended}
            onSchedule={onSchedule}
          />
        )
      )}
      <WarningList warnings={notes} compact />
    </div>
  );
}

function VerdictTodo({
  status,
  canSchedule,
  onSchedule,
}: {
  status: Status;
  /** 이번 달 이후이고 종결하지 않았으면 모자란 방문을 바로 잡는다 */
  canSchedule: boolean;
  onSchedule: Schedule;
}) {
  const { recipient, missing, toConfirm, toVisit } = status;
  const lacking = PROFESSIONS.filter((profession) => missing[profession] > 0);
  /** "간호사 1회" */
  const need = (profession: Profession) =>
    `${PROFESSION_LABELS[profession]} ${missing[profession]}회`;
  const notes = [
    toConfirm > 0 && `지난 방문 ${toConfirm}건 확정`,
    toVisit > 0 && `예정 방문 ${toVisit}건 마치기`,
  ].filter(Boolean);
  // 지난달·종결이면 방문을 더 잡을 수 없어 글로만 남긴다.
  const actions = !canSchedule
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
