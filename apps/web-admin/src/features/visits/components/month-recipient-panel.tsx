import {
  emptyHomeCareCounts,
  HOME_CARE_MONTHLY_VISITS,
  PROFESSION_LABELS,
  type CareGrade,
  type HomeCareVisitCounts,
  type MonthRecipientSummary,
} from "@repo/shared-types";
import {
  Building2Icon,
  SearchIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { groupRows } from "@/features/organizations/lib/group-rows";
import { formatCareGrade } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NoVisitRecipient {
  id: string;
  name: string;
  careGrade: CareGrade | null;
  organizationId: string;
}

interface MonthRecipientPanelProps {
  month: string;
  /**
   * 이달 방문이 있는 수급자. undefined는 아직 받지 못함,
   * null은 방문이 너무 많아 목록을 받지 못함(전체 기관 보기).
   */
  summaries: MonthRecipientSummary[] | null | undefined;
  /** 처음 받는 중인지. undefined인데 받는 중이 아니면 받지 못한 것이다. */
  isLoading: boolean;
  /** 재택의료센터에 등록했지만 이달 방문이 없는 수급자(요건 부족이 가장 큰 경우) */
  noVisitRecipients: NoVisitRecipient[];
  /** 담당자·상태 필터 중에는 월 요건 판단이 맞지 않아 숨긴다. */
  showRequirements: boolean;
  selectedRecipientId: string | undefined;
  onSelectRecipient: (recipientId: string | undefined) => void;
  organizationNames?: Map<string, string>;
}

const HOME_CARE_PARTS: { key: keyof HomeCareVisitCounts; short: string }[] = [
  { key: "DOCTOR", short: "의" },
  { key: "NURSE", short: "간" },
  { key: "SOCIAL_WORKER", short: "사" },
];

type SortOrder = "shortfall" | "name";

/**
 * 달력 옆 "이달 수급자" 목록. 수급자별 방문·확정 수와 재택의료 월 요건(의사 1·간호사 2·
 * 사회복지사 1)을 보여 주고, 누르면 달력이 그 수급자 방문만 보여 준다.
 */
export function MonthRecipientPanel({
  month,
  summaries,
  isLoading,
  noVisitRecipients,
  showRequirements,
  selectedRecipientId,
  onSelectRecipient,
  organizationNames,
}: MonthRecipientPanelProps) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<SortOrder>("shortfall");
  const monthNumber = Number(month.slice(5));
  const keyword = query.trim();

  const matches = (name: string) => !keyword || name.includes(keyword);
  // 받은 목록이 이름순이라, 부족순은 부족한 건수로만 다시 정렬한다(같으면 이름순 그대로).
  const visible = (summaries ?? []).filter((summary) =>
    matches(summary.recipient.name),
  );
  if (order === "shortfall" && showRequirements) {
    visible.sort((a, b) => b.homeCareShortfall - a.homeCareShortfall);
  }
  // 운영자가 전체 기관을 볼 때만 기관별로 나눈다.
  const groups = organizationNames
    ? groupRows(visible, (summary) => ({
        key: summary.organizationId,
        label: organizationNames.get(summary.organizationId) ?? "기관",
      }))
    : [{ key: "", label: "", rows: visible }];
  const noVisit = noVisitRecipients.filter((recipient) =>
    matches(recipient.name),
  );
  const shortCount = showRequirements
    ? (summaries ?? []).filter((summary) => summary.homeCareShortfall > 0)
        .length + noVisitRecipients.length
    : 0;

  return (
    <aside
      aria-label={`${monthNumber}월 수급자`}
      className="border-border bg-card flex min-h-0 flex-col rounded-md border"
    >
      <div className="flex flex-col gap-2 border-b px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <UsersIcon className="text-muted-foreground size-4" aria-hidden />
            {monthNumber}월 수급자
            {summaries && (
              <span className="text-muted-foreground font-normal tabular-nums">
                {summaries.length}명
              </span>
            )}
          </h3>
          {showRequirements && (
            <Select
              aria-label="정렬"
              title="정렬: 부족순은 재택의료 월 요건이 모자란 수급자를 먼저 보여 줍니다"
              containerClassName="w-24"
              className="h-8 text-xs"
              value={order}
              onChange={(event) => setOrder(event.target.value as SortOrder)}
            >
              <option value="shortfall">부족순</option>
              <option value="name">이름순</option>
            </Select>
          )}
        </div>
        <div className="relative">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            aria-label="수급자 이름 검색"
            placeholder="이름 검색"
            className="h-8 pl-8 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {shortCount > 0 && (
          <p className="text-warning flex items-center gap-1 text-xs font-medium">
            <TriangleAlertIcon className="size-3.5" aria-hidden />
            재택의료 월 요건이 모자란 수급자 {shortCount}명
          </p>
        )}
        {!showRequirements && (
          <p className="text-muted-foreground text-xs">
            담당자·상태 필터 중에는 재택의료 월 요건을 보여 주지 않습니다.
          </p>
        )}
      </div>

      <div className="max-h-[36rem] min-h-0 flex-1 overflow-y-auto p-1.5">
        {summaries === undefined ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-[13px]">
            {isLoading ? "불러오는 중…" : "수급자 목록을 불러오지 못했습니다"}
          </p>
        ) : summaries === null ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-[13px]">
            방문이 많아 수급자 목록을 보여 줄 수 없습니다. 기관을 골라 주세요.
          </p>
        ) : visible.length === 0 && noVisit.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-[13px]">
            {keyword ? "검색 결과가 없습니다" : "이달 방문이 없습니다"}
          </p>
        ) : (
          <>
            {groups.map((group) => (
              <section
                key={group.key}
                aria-label={organizationNames ? group.label : undefined}
              >
                {organizationNames && (
                  <h4 className="text-muted-foreground flex items-center gap-1.5 px-2 pt-2 pb-1 text-xs font-semibold">
                    <Building2Icon className="size-3.5" aria-hidden />
                    {group.label}
                    <span className="font-normal tabular-nums">
                      {group.rows.length}명
                    </span>
                  </h4>
                )}
                <ul className="flex flex-col gap-0.5">
                  {group.rows.map((summary) => (
                    <li key={summary.recipient.id}>
                      <RecipientButton
                        name={summary.recipient.name}
                        detail={[formatCareGrade(summary.recipient.careGrade)]}
                        stats={`방문 ${summary.total} · 확정 ${summary.confirmed}`}
                        homeCare={showRequirements ? summary.homeCare : null}
                        selected={selectedRecipientId === summary.recipient.id}
                        onClick={() =>
                          onSelectRecipient(
                            selectedRecipientId === summary.recipient.id
                              ? undefined
                              : summary.recipient.id,
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {noVisit.length > 0 && (
              <div className="mt-2 border-t pt-2">
                <p className="text-muted-foreground px-2 pb-1 text-xs font-semibold">
                  이달 방문 없는 재택의료 수급자 {noVisit.length}명
                </p>
                <ul className="flex flex-col gap-0.5">
                  {noVisit.map((recipient) => (
                    <li key={recipient.id}>
                      <RecipientButton
                        name={recipient.name}
                        detail={[
                          formatCareGrade(recipient.careGrade),
                          organizationNames?.get(recipient.organizationId),
                        ]}
                        stats="방문 0"
                        homeCare={emptyHomeCareCounts()}
                        selected={selectedRecipientId === recipient.id}
                        onClick={() =>
                          onSelectRecipient(
                            selectedRecipientId === recipient.id
                              ? undefined
                              : recipient.id,
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function RecipientButton({
  name,
  detail,
  stats,
  homeCare,
  selected,
  onClick,
}: {
  name: string;
  detail: (string | undefined)[];
  stats: string;
  homeCare: HomeCareVisitCounts | null;
  selected: boolean;
  onClick: () => void;
}) {
  const detailText = detail.filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/25 flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-3",
        selected ? "bg-primary-soft" : "hover:bg-muted",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "truncate text-sm font-medium",
            selected && "text-primary",
          )}
        >
          {name}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {stats}
        </span>
      </span>
      {detailText && (
        <span className="text-muted-foreground truncate text-xs">
          {detailText}
        </span>
      )}
      {homeCare && (
        <span className="flex flex-wrap gap-x-1.5 text-xs tabular-nums">
          <span className="text-muted-foreground">재택</span>
          {HOME_CARE_PARTS.map(({ key, short }) => {
            const required = HOME_CARE_MONTHLY_VISITS[key];
            const short_ = homeCare[key] < required;
            return (
              <span
                key={key}
                title={`${PROFESSION_LABELS[key]} ${homeCare[key]}회 / 요건 ${required}회`}
                className={
                  short_ ? "text-warning font-semibold" : "text-success"
                }
              >
                {short} {homeCare[key]}/{required}
              </span>
            );
          })}
        </span>
      )}
    </button>
  );
}
