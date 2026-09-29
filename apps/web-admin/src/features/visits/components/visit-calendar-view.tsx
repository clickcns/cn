import { getErrorMessage } from "@repo/api-client";
import {
  formChoicesFor,
  formatDateLabel,
  formatMonthLabel,
  addKstDays,
  addMonths,
  canRescheduleVisit,
  formRulesFor,
  monthGridDates,
  monthOf,
  summarizeCalendarMonth,
  summarizeMonthRecipients,
  visitProfession,
  VISIT_STATUS_LABELS,
  VISIT_STATUSES,
  withKstDate,
  type VisitCalendarDay,
  type VisitCalendarItem,
  type VisitCalendarQuery,
} from "@repo/shared-types";
import {
  CalendarXIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/data-state";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useRecipients } from "@/features/recipients/hooks/use-recipients";
import {
  CalendarContextMenu,
  type CalendarMenuActions,
} from "@/features/visits/components/calendar-context-menu";
import type { CreateVisitDefaults } from "@/features/visits/components/create-visit-dialog";
import { DeleteVisitDialog } from "@/features/visits/components/delete-visit-button";
import {
  MonthRecipientPanel,
  type NoVisitRecipient,
} from "@/features/visits/components/month-recipient-panel";
import { VisitCalendar } from "@/features/visits/components/visit-calendar";
import { VisitQuickViewDialog } from "@/features/visits/components/visit-quick-view-dialog";
import { VisitListFooter } from "@/features/visits/components/visit-list-footer";
import { VisitTable } from "@/features/visits/components/visit-table";
import { useCalendarDnd } from "@/features/visits/hooks/use-calendar-dnd";
import { findCell } from "@/features/visits/lib/calendar-dom";
import type { VisitConditions } from "@/features/visits/hooks/use-visit-filters";
import {
  useInfiniteVisits,
  useUpdateVisit,
  useVisitCalendar,
} from "@/features/visits/hooks/use-visits";
import {
  groupByDay,
  visitDate,
  visitTime,
  type QuickViewVisit,
} from "@/features/visits/lib/calendar-items";
import { useCalendarPrefsStore } from "@/features/visits/stores/use-calendar-prefs-store";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/api";

interface VisitCalendarViewProps {
  month: string;
  selectedDay: string;
  today: string;
  /**
   * 상태·사업·담당자 조건. 기간은 달이 정하므로 목록용 from/to가 섞이면 컴파일 오류가 나게 한다
   * (섞이면 펼침 순서에 따라 달력 범위를 덮어쓴다).
   */
  conditions: VisitConditions & { from?: never; to?: never };
  /** 이 수급자 방문만 본다. */
  recipientId: string | undefined;
  organizationId: string | undefined;
  organizationNames: Map<string, string> | undefined;
  onMonthChange: (month: string) => void;
  onSelectDay: (date: string) => void;
  onSelectRecipient: (recipientId: string | undefined) => void;
  /** 방문 등록 창을 연다(고른 날·수급자, 복사한 방문을 기본값으로). */
  onCreate: (defaults: CreateVisitDefaults) => void;
}

/**
 * 달력 보기: 달 넘기기·요약, 한 달 달력(방문 칩·끌어다 놓기), 이달 수급자 패널,
 * 고른 날의 방문 표, 방문 빠른 보기 창.
 */
export function VisitCalendarView({
  month,
  selectedDay,
  today,
  conditions,
  recipientId,
  organizationId,
  organizationNames,
  onMonthChange,
  onSelectDay,
  onSelectRecipient,
  onCreate,
}: VisitCalendarViewProps) {
  const dates = monthGridDates(month);
  const baseQuery: VisitCalendarQuery = {
    from: dates[0]!,
    to: dates.at(-1)!,
    status: conditions.status,
    program: conditions.program,
    staffId: conditions.staffId,
    organizationId,
    withVisits: "true",
  };
  // 칸·칩은 수급자 필터를 적용하고, 패널은 적용하지 않은 목록을 쓴다(필터가 없으면 같은 요청).
  const calendarQuery = useVisitCalendar({ ...baseQuery, recipientId });
  const panelQuery = useVisitCalendar(baseQuery);
  const recipientsQuery = useRecipients({
    organizationId,
    includeInactive: "false",
  });
  const [quickView, setQuickView] = useState<{
    visit: QuickViewVisit;
    mode: "view" | "edit";
  } | null>(null);
  const openVisit = (visit: QuickViewVisit) =>
    setQuickView({ visit, mode: "view" });
  // 우클릭 메뉴의 삭제 확인 창. 닫히는 동안에도 내용을 보여 주도록 대상은 따로 둔다.
  const [deleteTarget, setDeleteTarget] = useState<VisitCalendarItem | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dayTableRef = useRef<HTMLDivElement>(null);
  const updateVisit = useUpdateVisit();
  const expandAll = useCalendarPrefsStore((state) => state.expandAll);
  const setExpandAll = useCalendarPrefsStore((state) => state.setExpandAll);

  // 기관 범위를 바꾸면 이전 기관의 수급자 필터를 푼다.
  const previousOrganization = useRef(organizationId);
  useEffect(() => {
    if (previousOrganization.current === organizationId) return;
    previousOrganization.current = organizationId;
    if (recipientId) onSelectRecipient(undefined);
  }, [organizationId, recipientId, onSelectRecipient]);

  const calendarData = calendarQuery.data;
  const days = useMemo(
    () =>
      new Map<string, VisitCalendarDay>(
        (calendarData?.days ?? []).map((day) => [day.date, day]),
      ),
    [calendarData],
  );
  // 목록이 null이면(상한 초과) 칩 없이 건수만 보여 준다.
  const itemsByDay = useMemo(
    () =>
      calendarData?.visits === null
        ? null
        : groupByDay(calendarData?.visits ?? []),
    [calendarData],
  );

  const summary = useMemo(
    () => summarizeCalendarMonth(days.values(), month, today),
    [days, month, today],
  );

  // undefined는 아직 받지 못함, null은 상한 초과로 목록이 없음. 받기 전에 빈 목록으로 세면
  // 재택의료 수급자가 모두 "이달 방문 없음"으로 잠깐 보인다.
  const panelVisits = panelQuery.data?.visits;
  const summaries = useMemo(
    () =>
      panelVisits == null
        ? panelVisits
        : summarizeMonthRecipients(panelVisits, month),
    [panelVisits, month],
  );
  // 담당자·상태 필터 중에는 월 요건(직종별 횟수) 판단이 맞지 않는다.
  const showRequirements = !conditions.staffId && !conditions.status;
  const noVisitRecipients: NoVisitRecipient[] = useMemo(() => {
    if (!showRequirements || !summaries) return [];
    if (conditions.program && conditions.program !== "HOME_CARE_CENTER") {
      return [];
    }
    const visited = new Set(summaries.map((s) => s.recipient.id));
    return (recipientsQuery.data ?? [])
      .filter(
        (recipient) =>
          recipient.programs.includes("HOME_CARE_CENTER") &&
          !visited.has(recipient.id),
      )
      .map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        careGrade: recipient.careGrade,
        organizationId: recipient.organizationId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [showRequirements, summaries, conditions.program, recipientsQuery.data]);

  const selectedRecipientName = recipientId
    ? (summaries?.find((s) => s.recipient.id === recipientId)?.recipient.name ??
      recipientsQuery.data?.find((r) => r.id === recipientId)?.name ??
      "선택한 수급자")
    : null;

  /** 끌어다 놓기: 시각은 그대로 두고 날짜만 옮긴다. 옮긴 뒤 되돌리기 버튼을 준다. */
  const moveVisit = async (item: VisitCalendarItem, date: string) => {
    // 옮긴 날에 재택의료 급여를 산정하지 않는 겹침이 있는지 함께 묻는다(옮기기 결과와 상관없다).
    // 경고를 못 받아도 옮기기는 끝난 것이라 실패는 빈 목록으로 본다.
    const warningsRequest = api.visits
      .sameDayWarnings({
        recipientId: item.recipient.id,
        program: item.program,
        staffId: item.staff.id,
        date,
      })
      .then(
        (response) => response.warnings,
        () => [],
      );
    let movedAt: string;
    try {
      const moved = await updateVisit.mutateAsync({
        id: item.id,
        input: {
          scheduledAt: withKstDate(item.scheduledAt, date),
          expectedScheduledAt: item.scheduledAt,
        },
      });
      movedAt = moved.scheduledAt;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }
    toast.success(
      `${item.recipient.name} 방문을 ${formatDateLabel(date)}로 옮겼습니다`,
      {
        duration: 8000,
        action: {
          label: "되돌리기",
          onClick: () => {
            updateVisit
              .mutateAsync({
                id: item.id,
                input: {
                  scheduledAt: item.scheduledAt,
                  expectedScheduledAt: movedAt,
                },
              })
              .then(
                () => toast.success("되돌렸습니다"),
                (error: unknown) => toast.error(getErrorMessage(error)),
              );
          },
        },
      },
    );
    // 옮기기는 막지 않고 알리기만 한다.
    for (const warning of await warningsRequest) toast.warning(warning);
  };
  const dnd = useCalendarDnd((item, date) => void moveVisit(item, date));

  const visitsById = useMemo(
    () => new Map((calendarData?.visits ?? []).map((item) => [item.id, item])),
    [calendarData],
  );
  const menuActions: CalendarMenuActions = {
    openVisit,
    editVisit: (item) => setQuickView({ visit: item, mode: "edit" }),
    deleteVisit: (item) => {
      setDeleteTarget(item);
      setDeleteOpen(true);
    },
    copyVisit: (item) => {
      // 원래 방문의 서식 선택을 잇는다(담당자를 바꾸면 등록 창이 새 직종 규칙으로 다시 고른다).
      const rules = formRulesFor(
        item.program,
        visitProfession(item.program, item.formIds),
      );
      onCreate({
        date: addKstDays(visitDate(item), 7),
        time: visitTime(item),
        recipientId: item.recipient.id,
        program: item.program,
        // 사용 중지된 담당자는 고를 수 없으니 비워 둔다.
        staffId: item.staff.isActive ? item.staff.id : undefined,
        formChoices: formChoicesFor(rules, item.formIds),
        copiedFrom: `${item.recipient.name}의 ${formatDateLabel(visitDate(item))} ${visitTime(item)}`,
      });
    },
    createVisit: (date, recipient) =>
      onCreate({ date, recipientId: recipient }),
    showDay: (date) => {
      onSelectDay(date);
      dayTableRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    filterRecipient: onSelectRecipient,
  };
  const canDrag = (item: VisitCalendarItem) =>
    canRescheduleVisit(item.status) &&
    !updateVisit.isPending &&
    !calendarQuery.isPlaceholderData;

  const monthNumber = Number(month.slice(5));
  const thisMonth = monthOf(today);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="이전 달"
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <h2
            className="min-w-28 text-center text-base font-semibold tabular-nums"
            aria-live="polite"
          >
            {formatMonthLabel(month)}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="다음 달"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-1"
            disabled={month === thisMonth}
            onClick={() => onMonthChange(thisMonth)}
          >
            이번 달
          </Button>
          {calendarQuery.isFetching && <Spinner className="ml-2" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* 칩이 있을 때만(상한 초과면 칸에 건수만 있다) */}
          {itemsByDay && (
            <div className="flex items-center gap-2">
              <Switch
                id="calendar-expand-all"
                checked={expandAll}
                onCheckedChange={setExpandAll}
              />
              <label
                htmlFor="calendar-expand-all"
                className="cursor-pointer text-[13px] font-medium"
              >
                방문 모두 펼치기
              </label>
            </div>
          )}
          {calendarData && (
            <p className="text-muted-foreground text-[13px] tabular-nums">
              {monthNumber}월 전체{" "}
              <strong className="text-foreground">{summary.total}건</strong>
              {VISIT_STATUSES.map((status) => (
                <span key={status}>
                  {" "}
                  · {VISIT_STATUS_LABELS[status]} {summary.counts[status]}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      {(selectedRecipientName || summary.firstOverdue) && (
        <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
          {selectedRecipientName && (
            <span className="bg-primary-soft text-primary inline-flex items-center gap-1 rounded-md py-1 pr-1 pl-3 text-[13px] font-semibold">
              {selectedRecipientName} 방문만 보는 중
              <button
                type="button"
                aria-label="수급자 필터 해제"
                onClick={() => onSelectRecipient(undefined)}
                className="hover:bg-primary/10 focus-visible:ring-ring/25 rounded p-1 outline-none focus-visible:ring-3"
              >
                <XIcon className="size-3.5" />
              </button>
            </span>
          )}
          {summary.firstOverdue && (
            <button
              type="button"
              onClick={() => onSelectDay(summary.firstOverdue!)}
              className="bg-warning-soft text-warning focus-visible:ring-ring/25 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold outline-none focus-visible:ring-3"
            >
              <TriangleAlertIcon className="size-4" aria-hidden />이 달력에서
              확정 안 한 지난 방문 {summary.overdue}건 · 가장 이른 날 보기
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 flex-col gap-2">
          {calendarQuery.isError ? (
            <ErrorState
              error={calendarQuery.error}
              title="달력을 불러오지 못했습니다"
              onRetry={() => void calendarQuery.refetch()}
            />
          ) : (
            <CalendarContextMenu
              findVisit={(id) => visitsById.get(id)}
              filteredRecipient={
                recipientId && selectedRecipientName
                  ? { id: recipientId, name: selectedRecipientName }
                  : null
              }
              actions={menuActions}
            >
              <VisitCalendar
                month={month}
                selected={selectedDay}
                today={today}
                days={days}
                itemsByDay={itemsByDay}
                chipLabel={recipientId ? "staff" : "recipient"}
                expandAll={expandAll}
                onExpandAll={() => setExpandAll(true)}
                dnd={dnd}
                canDrag={canDrag}
                onSelect={onSelectDay}
                onOpenVisit={openVisit}
              />
            </CalendarContextMenu>
          )}
          <p className="text-muted-foreground text-xs">
            방문을 누르면 요약을 보고 일정·담당자를 바꿀 수 있습니다. 확정 전
            방문은 다른 날로 끌어 옮길 수 있습니다. 방문이나 날짜를 우클릭하면
            등록·복사·삭제 메뉴가 열립니다. 방향키로 날짜를 옮기고 Enter로 그날
            방문에 들어갑니다.
          </p>
        </div>
        <MonthRecipientPanel
          month={month}
          summaries={summaries}
          isLoading={panelQuery.isPending}
          noVisitRecipients={noVisitRecipients}
          showRequirements={showRequirements}
          selectedRecipientId={recipientId}
          onSelectRecipient={onSelectRecipient}
          organizationNames={organizationNames}
        />
      </div>

      <div ref={dayTableRef} className="scroll-mt-4">
        <SelectedDayVisits
          date={selectedDay}
          conditions={conditions}
          recipientId={recipientId}
          organizationId={organizationId}
          organizationNames={organizationNames}
          onCreate={() => onCreate({ date: selectedDay, recipientId })}
          onOpenVisit={openVisit}
        />
      </div>

      <VisitQuickViewDialog
        visit={quickView?.visit ?? null}
        mode={quickView?.mode}
        onClose={() => setQuickView(null)}
        onFilterRecipient={onSelectRecipient}
        organizationNames={organizationNames}
      />
      {deleteTarget && (
        <DeleteVisitDialog
          visit={deleteTarget}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          // 우클릭 메뉴로 열어 돌아갈 곳이 없으니 그 방문이 있던 날짜 칸으로 간다.
          returnFocus={() => findCell(visitDate(deleteTarget))}
        />
      )}
    </>
  );
}

/** 달력에서 고른 날의 방문 표. 조건·수급자 필터는 달력과 같다. */
function SelectedDayVisits({
  date,
  conditions,
  recipientId,
  organizationId,
  organizationNames,
  onCreate,
  onOpenVisit,
}: {
  date: string;
  conditions: VisitConditions;
  recipientId: string | undefined;
  organizationId: string | undefined;
  organizationNames: Map<string, string> | undefined;
  onCreate: () => void;
  onOpenVisit: (visit: QuickViewVisit) => void;
}) {
  // 방향키로 날짜를 빠르게 옮기는 동안 요청이 쏟아지지 않게 한다.
  const tableDate = useDebouncedValue(date, 150);
  const visitsQuery = useInfiniteVisits({
    from: tableDate,
    to: tableDate,
    status: conditions.status,
    program: conditions.program,
    staffId: conditions.staffId,
    recipientId,
    organizationId,
    groupBy: organizationNames ? "organization" : undefined,
  });
  const list = visitsQuery.data;
  const listError = visitsQuery.isError && !visitsQuery.isFetchNextPageError;

  return (
    <section className="border-t" aria-label="고른 날의 방문">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <h3 className="text-[15px] font-semibold">
          {formatDateLabel(date)} 방문
          {list && !listError && tableDate === date && (
            <span className="text-muted-foreground ml-2 font-normal tabular-nums">
              {list.total}건
            </span>
          )}
        </h3>
        <Button variant="outline" size="sm" onClick={onCreate}>
          <PlusIcon />이 날짜로 방문 등록
        </Button>
      </div>
      {listError ? (
        <ErrorState
          error={visitsQuery.error}
          title="방문 목록을 불러오지 못했습니다"
          onRetry={() => void visitsQuery.refetch()}
        />
      ) : !list ? (
        <LoadingState message="방문 목록을 불러오는 중입니다…" />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={CalendarXIcon}
          title="이 날짜에 방문이 없습니다"
          description="다른 날짜를 누르거나 이 날짜로 방문을 등록해 보세요."
        />
      ) : (
        <>
          <VisitTable
            visits={list.items}
            organizationNames={organizationNames}
            organizationCounts={list.organizationCounts}
            onRowClick={onOpenVisit}
          />
          <VisitListFooter query={visitsQuery} />
        </>
      )}
    </section>
  );
}
