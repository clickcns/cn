import {
  addKstDays,
  addMonths,
  formatMonthLabel,
  monthGridDates,
  monthOf,
  summarizeCalendarMonth,
  unconfirmedCount,
  WEEKDAY_LABELS,
  type VisitCalendarDay,
} from "@repo/shared-types";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { useMemo, useRef, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { PageError } from "@/components/ui/page-state";
import { useVisitCalendar } from "@/features/visits/hooks/use-visits";
import { formatDateLabel } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * 날짜 칸의 방문 건수 색:
 * - 지난 날에 확정하지 않은 방문이 있으면 주황(기록을 마저 써야 함)
 * - 모두 확정했으면 초록
 * - 그 밖(오늘·앞으로 할 방문)은 파랑
 */
type DayTone = "planned" | "done" | "overdue";

const TONE_CLASSES: Record<DayTone, string> = {
  planned: "bg-primary-soft text-primary",
  done: "bg-success-soft text-success",
  overdue: "bg-warning-soft text-warning ring-1 ring-warning/60",
};

const LEGEND: { tone: DayTone; label: string }[] = [
  { tone: "planned", label: "할 방문" },
  { tone: "done", label: "모두 확정" },
  { tone: "overdue", label: "지난 날 확정 안 함" },
];

/** 이만큼 옆으로 밀면 넘긴다(px). 세로 이동보다 커야 한다. */
const SWIPE_DISTANCE = 60;

function dayTone(day: VisitCalendarDay, isPast: boolean): DayTone {
  const unconfirmed = unconfirmedCount(day.counts);
  if (unconfirmed === 0) return "done";
  return isPast ? "overdue" : "planned";
}

interface ScheduleCalendarProps {
  /** 고른 날짜(YYYY-MM-DD) */
  date: string;
  today: string;
  /** 한 달을 모두 보여 준다. 아니면 고른 날이 있는 한 주만 보여 준다. */
  expanded: boolean;
  /** 펼치기·접기 버튼을 보여 줄지(넓은 화면은 늘 한 달이다). */
  collapsible: boolean;
  onToggleExpanded: () => void;
  onSelect: (date: string) => void;
}

/**
 * 방문 일정 달력. 좁은 화면은 한 주 줄로 접혀 있고 펼치면 한 달이 된다.
 * 날짜마다 방문 건수를 보여 주고, 누르면 그날을 고른다. 옆으로 밀면 이전·다음 주(달)로 넘긴다.
 * 달력 칸에 보이는 앞뒤 달 날짜까지 한 번에 센다.
 */
export function ScheduleCalendar({
  date,
  today,
  expanded,
  collapsible,
  onToggleExpanded,
  onSelect,
}: ScheduleCalendarProps) {
  const month = monthOf(date);
  const dates = monthGridDates(month);
  const calendarQuery = useVisitCalendar(dates[0]!, dates.at(-1)!);

  const days = useMemo(
    () =>
      new Map<string, VisitCalendarDay>(
        (calendarQuery.data?.days ?? []).map((day) => [day.date, day]),
      ),
    [calendarQuery.data],
  );

  const summary = summarizeCalendarMonth(days.values(), month, today);

  // 고른 날이 있는 주. 고른 날은 늘 그 달의 칸(앞뒤 달 날짜 포함) 안에 있다.
  const weekStart = dates.indexOf(date) - (dates.indexOf(date) % 7);
  const visibleDates = expanded ? dates : dates.slice(weekStart, weekStart + 7);

  /** 이전·다음: 펼쳤으면 달(이번 달은 오늘, 그 밖은 1일), 접었으면 주(같은 요일). */
  const step = (direction: -1 | 1) => {
    if (!expanded) {
      onSelect(addKstDays(date, direction * 7));
      return;
    }
    const next = addMonths(month, direction);
    onSelect(next === monthOf(today) ? today : `${next}-01`);
  };
  const unit = expanded ? "달" : "주";

  // 옆으로 밀기. 민 뒤에 따라오는 click은 날짜 선택으로 보지 않는다.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current =
      event.pointerType === "mouse"
        ? null
        : { x: event.clientX, y: event.clientY };
    swiped.current = false;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) {
      return;
    }
    swiped.current = true;
    step(dx < 0 ? 1 : -1);
  };

  return (
    <section
      aria-label="방문 달력"
      className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-2 sm:p-4"
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`이전 ${unit}`}
          onClick={() => step(-1)}
        >
          <ChevronLeft className="size-7" />
        </Button>
        <h2
          className="flex-1 text-center text-lg font-bold tabular-nums sm:text-xl"
          aria-live="polite"
        >
          {formatMonthLabel(month)}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`다음 ${unit}`}
          onClick={() => step(1)}
        >
          <ChevronRight className="size-7" />
        </Button>
        <Button
          variant="soft"
          size="sm"
          onClick={() => onSelect(today)}
          disabled={date === today}
        >
          오늘
        </Button>
      </div>

      {calendarQuery.isError ? (
        <PageError
          error={calendarQuery.error}
          fallback="달력을 불러오지 못했습니다"
          onRetry={() => void calendarQuery.refetch()}
        />
      ) : (
        <div
          className="grid touch-pan-y grid-cols-7 gap-1"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
          onClickCapture={(event) => {
            if (!swiped.current) return;
            swiped.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              aria-hidden
              className={cn(
                "text-muted-foreground pb-1 text-center text-sm font-semibold",
                index === 0 && "text-destructive",
                index === 6 && "text-primary",
              )}
            >
              {label}
            </div>
          ))}
          {visibleDates.map((cellDate, index) => (
            <DayCell
              key={cellDate}
              date={cellDate}
              day={days.get(cellDate)}
              weekday={index % 7}
              // 한 주 줄에서는 앞뒤 달 날짜도 흐리게 하지 않는다.
              inMonth={!expanded || monthOf(cellDate) === month}
              isToday={cellDate === today}
              isPast={cellDate < today}
              isSelected={cellDate === date}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {collapsible && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          aria-expanded={expanded}
          onClick={onToggleExpanded}
        >
          {expanded ? <ChevronUp /> : <ChevronDown />}
          {expanded ? "한 주로 접기" : "한 달 펼치기"}
        </Button>
      )}

      {expanded && (
        <>
          <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 px-1 text-sm">
            {LEGEND.map(({ tone, label }) => (
              <li key={tone} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn("size-3.5 rounded-full", TONE_CLASSES[tone])}
                />
                {label}
              </li>
            ))}
            <li>숫자는 방문 건수</li>
          </ul>
          <p className="text-muted-foreground px-1" aria-live="polite">
            {Number(month.slice(5))}월 방문{" "}
            <strong className="text-foreground">
              {calendarQuery.isPending ? "…" : `${summary.total}건`}
            </strong>
            {" · "}확정 {summary.counts.CONFIRMED}건
          </p>
        </>
      )}

      {summary.firstOverdue && (
        <button
          type="button"
          onClick={() => onSelect(summary.firstOverdue!)}
          className="bg-warning-soft text-warning focus-visible:ring-ring/30 flex min-h-12 items-center gap-2 rounded-xl px-4 py-2 text-left text-base font-semibold outline-none focus-visible:ring-4"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span>
            확정 안 한 지난 방문 {summary.overdue}건 · 가장 이른 날 보기
          </span>
        </button>
      )}
    </section>
  );
}

function DayCell({
  date,
  day,
  weekday,
  inMonth,
  isToday,
  isPast,
  isSelected,
  onSelect,
}: {
  date: string;
  day: VisitCalendarDay | undefined;
  weekday: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  onSelect: (date: string) => void;
}) {
  const tone = day ? dayTone(day, isPast) : null;
  const unconfirmed = day ? unconfirmedCount(day.counts) : 0;
  const label = [
    formatDateLabel(date),
    isToday ? "오늘" : null,
    day ? `방문 ${day.total}건` : "방문 없음",
    tone === "overdue" ? `확정 안 한 방문 ${unconfirmed}건` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-label={label}
      aria-pressed={isSelected}
      aria-current={isToday ? "date" : undefined}
      className={cn(
        "focus-visible:ring-ring/30 hover:bg-muted flex min-h-17 flex-col items-center gap-1 rounded-xl border-2 border-transparent px-0.5 py-1.5 transition-colors outline-none focus-visible:ring-4",
        isSelected &&
          "border-primary bg-primary-soft/50 hover:bg-primary-soft/50",
        !inMonth && "opacity-45",
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full text-base font-semibold tabular-nums",
          isToday && "bg-primary text-primary-foreground",
          !isToday && weekday === 0 && "text-destructive",
          !isToday && weekday === 6 && "text-primary",
        )}
      >
        {Number(date.slice(8))}
      </span>
      {day && tone && (
        <span
          aria-hidden
          className={cn(
            "min-w-7 rounded-full px-1.5 text-sm leading-6 font-bold tabular-nums",
            TONE_CLASSES[tone],
          )}
        >
          {day.total}
        </span>
      )}
    </button>
  );
}
