import {
  formatMonthLabel,
  monthGridDates,
  monthOf,
  shiftCalendarDate,
  WEEKDAY_LABELS,
  type VisitCalendarDay,
  type VisitCalendarItem,
} from "@repo/shared-types";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { CalendarCell } from "@/features/visits/components/calendar-cell";
import type { ChipLabel } from "@/features/visits/components/visit-chip";
import type { CalendarDnd } from "@/features/visits/hooks/use-calendar-dnd";
import {
  CHIP_OR_MORE_SELECTOR,
  findCell,
} from "@/features/visits/lib/calendar-dom";
import { cn } from "@/lib/utils";

/** 방문이 없는 날. 칸마다 새 빈 배열을 넘기면 칸을 매번 다시 그린다. */
const NO_ITEMS: readonly VisitCalendarItem[] = [];

interface VisitCalendarProps {
  /** YYYY-MM */
  month: string;
  selected: string;
  today: string;
  /** 날짜별 건수. 방문이 없는 날은 없다. */
  days: ReadonlyMap<string, VisitCalendarDay>;
  /** 날짜별 방문. null이면 칩 없이 건수만 보여 준다(상한 초과). */
  itemsByDay: ReadonlyMap<string, VisitCalendarItem[]> | null;
  chipLabel: ChipLabel;
  /** 칸마다 방문을 모두 보여 준다. */
  expandAll: boolean;
  onExpandAll: () => void;
  dnd: CalendarDnd;
  canDrag: (item: VisitCalendarItem) => boolean;
  onSelect: (date: string) => void;
  onOpenVisit: (item: VisitCalendarItem) => void;
}

/**
 * 한 달 달력(grid). 칸 하나만 Tab으로 들어가고(고른 날) 방향키로 날짜를 옮긴다.
 * ←→ 하루, ↑↓ 일주일, Home/End 그 주의 처음·끝, PageUp/PageDown 전·다음 달,
 * Enter 칸 안의 방문 칩으로, 칩에서 ↑↓ 이동·Enter 빠른 보기·Esc 칸으로.
 */
export function VisitCalendar({
  month,
  selected,
  today,
  days,
  itemsByDay,
  chipLabel,
  expandAll,
  onExpandAll,
  dnd,
  canDrag,
  onSelect,
  onOpenVisit,
}: VisitCalendarProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  // 키보드로 옮긴 날짜. 다시 그린 뒤(달이 바뀌어도) 그 칸으로 포커스를 옮긴다.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const date = pendingFocus.current;
    if (!date) return;
    pendingFocus.current = null;
    if (gridRef.current) findCell(date, gridRef.current)?.focus();
  }, [selected, month]);

  const onCellKeyDown = (event: KeyboardEvent<HTMLElement>, date: string) => {
    // 칩에서 올라온 키는 칩이 처리한다.
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const first = event.currentTarget.querySelector<HTMLElement>(
        CHIP_OR_MORE_SELECTOR,
      );
      if (first) first.focus();
      else onSelect(date);
      return;
    }
    const next = shiftCalendarDate(date, event.key);
    if (!next) return;
    event.preventDefault();
    pendingFocus.current = next;
    onSelect(next);
  };

  // 훅 호출 뒤에 계산해야 React Compiler가 칸 목록·onCellKeyDown을 기억한다
  // (기억 범위는 훅 호출을 넘지 못한다).
  const dates = monthGridDates(month);
  const weeks = Array.from({ length: dates.length / 7 }, (_, index) =>
    dates.slice(index * 7, index * 7 + 7),
  );

  return (
    <div className="overflow-x-auto">
      <div
        ref={gridRef}
        role="grid"
        aria-label={`${formatMonthLabel(month)} 방문 달력`}
        className="flex min-w-[680px] flex-col gap-1.5"
      >
        <div role="row" className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              role="columnheader"
              className={cn(
                "text-muted-foreground px-2 text-xs font-semibold",
                index === 0 && "text-destructive",
                index === 6 && "text-primary",
              )}
            >
              {label}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} role="row" className="grid grid-cols-7 gap-1.5">
            {week.map((date, index) => (
              <CalendarCell
                key={date}
                date={date}
                weekday={index}
                inMonth={monthOf(date) === month}
                isToday={date === today}
                isPast={date < today}
                isSelected={date === selected}
                day={days.get(date)}
                items={itemsByDay ? (itemsByDay.get(date) ?? NO_ITEMS) : null}
                chipLabel={chipLabel}
                expandAll={expandAll}
                onExpandAll={onExpandAll}
                isDropTarget={dnd.dropDate === date}
                dnd={dnd.handlers}
                canDrag={canDrag}
                onSelect={onSelect}
                onOpenVisit={onOpenVisit}
                onCellKeyDown={onCellKeyDown}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
