import {
  kstWeekday,
  unconfirmedCount,
  VISIT_STATUS_LABELS,
  VISIT_STATUSES,
  type VisitCalendarDay,
  type VisitCalendarItem,
} from "@repo/shared-types";
import { TriangleAlertIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { DayOverflowPopover } from "@/features/visits/components/day-overflow-popover";
import {
  VisitChip,
  type ChipLabel,
} from "@/features/visits/components/visit-chip";
import type { CalendarDndHandlers } from "@/features/visits/hooks/use-calendar-dnd";
import {
  CELL_SELECTOR,
  CHIP_OR_MORE_SELECTOR,
} from "@/features/visits/lib/calendar-dom";
import { visibleChipCount } from "@/features/visits/lib/calendar-items";
import { VISIT_STATUS_STYLES } from "@/features/visits/lib/status-styles";
import { cn } from "@/lib/utils";

export interface CalendarCellProps {
  date: string;
  weekday: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  /** 고른 날. Tab으로 들어오는 칸이기도 하다(roving tabindex). */
  isSelected: boolean;
  day: VisitCalendarDay | undefined;
  /** 그날 방문. null이면 목록 없이 건수만 보여 준다(상한 초과). */
  items: readonly VisitCalendarItem[] | null;
  chipLabel: ChipLabel;
  /** 방문을 모두 보여 준다("+N건 더"로 줄이지 않는다). */
  expandAll: boolean;
  onExpandAll: () => void;
  /** 끌고 있는 칩을 놓을 수 있는 칸으로 강조 */
  isDropTarget: boolean;
  /** 끌어다 놓기 핸들러(모든 칸이 같은 객체) */
  dnd: CalendarDndHandlers;
  canDrag: (item: VisitCalendarItem) => boolean;
  onSelect: (date: string) => void;
  onOpenVisit: (item: VisitCalendarItem) => void;
  onCellKeyDown: (event: KeyboardEvent<HTMLElement>, date: string) => void;
}

/** 칸 안 칩 사이를 ↑↓로 오가고, Esc로 칸으로 돌아간다. */
function navigateChips(event: KeyboardEvent<HTMLElement>) {
  const cell = event.currentTarget.closest<HTMLElement>(CELL_SELECTOR);
  if (!cell) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cell.focus();
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  event.stopPropagation();
  const chips = [...cell.querySelectorAll<HTMLElement>(CHIP_OR_MORE_SELECTOR)];
  const index = chips.indexOf(event.currentTarget);
  chips[index + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
}

/** 달력 한 칸: 날짜·건수·방문 칩(넘치면 "+N")·지난 날 미확정 표시. 끌어다 놓기 대상이다. */
export function CalendarCell({
  date,
  weekday,
  inMonth,
  isToday,
  isPast,
  isSelected,
  day,
  items,
  chipLabel,
  expandAll,
  onExpandAll,
  isDropTarget,
  dnd,
  canDrag,
  onSelect,
  onOpenVisit,
  onCellKeyDown,
}: CalendarCellProps) {
  const unconfirmed = day ? unconfirmedCount(day.counts) : 0;
  const overdue = isPast && unconfirmed > 0;
  const [, monthNumber, dayNumber] = date.split("-").map(Number);
  const visible = !items
    ? []
    : expandAll
      ? items
      : items.slice(0, visibleChipCount(items.length));
  const hidden = items ? items.length - visible.length : 0;
  const label = [
    `${monthNumber}월 ${dayNumber}일 ${kstWeekday(date)}요일`,
    isToday ? "오늘" : null,
    day
      ? VISIT_STATUSES.filter((status) => day.counts[status] > 0)
          .map(
            (status) =>
              `${VISIT_STATUS_LABELS[status]} ${day.counts[status]}건`,
          )
          .join(", ")
      : "방문 없음",
    overdue ? `확정 안 한 지난 방문 ${unconfirmed}건` : null,
    items && items.length > 0 ? "Enter로 방문 목록에 들어갑니다" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="gridcell"
      data-date={date}
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      aria-current={isToday ? "date" : undefined}
      aria-label={label}
      onClick={() => onSelect(date)}
      onKeyDown={(event) => onCellKeyDown(event, date)}
      {...dnd.cellProps(date)}
      className={cn(
        "border-border bg-card hover:border-primary/50 focus-visible:ring-ring/25 flex min-h-28 min-w-0 cursor-pointer flex-col gap-1 rounded-md border p-1.5 text-left transition-colors outline-none focus-visible:ring-3",
        !inMonth && "bg-muted/40",
        overdue && "border-warning/60",
        isSelected && "border-primary ring-primary ring-1",
        isDropTarget && "border-primary bg-primary-soft/50 border-dashed",
      )}
    >
      <div className="flex items-center justify-between gap-1 px-0.5">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
            !inMonth && "text-muted-foreground",
            isToday && "bg-primary text-primary-foreground",
            !isToday && inMonth && weekday === 0 && "text-destructive",
            !isToday && inMonth && weekday === 6 && "text-primary",
          )}
        >
          {dayNumber}
        </span>
        {day && (
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {day.total}건
          </span>
        )}
      </div>

      {items ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          {visible.map((item) => (
            <VisitChip
              key={item.id}
              item={item}
              label={chipLabel}
              onOpen={onOpenVisit}
              dragProps={dnd.chipProps(item, canDrag(item))}
              onKeyNavigate={navigateChips}
            />
          ))}
          {hidden > 0 && (
            <DayOverflowPopover
              date={date}
              items={items}
              hiddenCount={hidden}
              label={chipLabel}
              onOpen={onOpenVisit}
              onExpandAll={onExpandAll}
            />
          )}
        </div>
      ) : (
        day && (
          <ul className="flex flex-col gap-0.5 px-0.5 text-xs">
            {VISIT_STATUSES.filter((status) => day.counts[status] > 0).map(
              (status) => (
                <li key={status} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      VISIT_STATUS_STYLES[status].dot,
                    )}
                  />
                  <span className="text-muted-foreground">
                    {VISIT_STATUS_LABELS[status]}
                  </span>
                  <span className="ml-auto font-medium tabular-nums">
                    {day.counts[status]}
                  </span>
                </li>
              ),
            )}
          </ul>
        )
      )}

      {overdue && (
        <span className="text-warning mt-auto inline-flex items-center gap-1 px-0.5 text-xs font-semibold">
          <TriangleAlertIcon className="size-3.5" aria-hidden />
          미확정 {unconfirmed}
        </span>
      )}
    </div>
  );
}
