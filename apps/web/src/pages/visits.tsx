import { formatKstDate, isIsoDate } from "@repo/shared-types";
import { Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DayVisits } from "@/features/visits/components/day-visits";
import { ScheduleCalendar } from "@/features/visits/components/schedule-calendar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import { newVisitPath } from "@/lib/routes";

/**
 * 방문 일정: 달력과 고른 날의 방문을 한 화면에 둔다.
 * 좁은 화면은 한 주 줄(펼치면 한 달) 아래에 그날 방문, 넓은 화면은 한 달 달력 옆에 그날 방문.
 */
export default function VisitsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = formatKstDate();
  // 날짜는 주소에 두어 방문을 열었다가 뒤로 가도 그날로 돌아온다.
  const dateParam = searchParams.get("date");
  const date = isIsoDate(dateParam) ? dateParam : today;
  const isWide = useMediaQuery("(min-width: 64rem)");
  // 좁은 화면에서 한 달 달력을 펼쳐 둘지(마지막 선택).
  const [expandedChoice, toggleExpanded] = useStoredFlag(
    "carenote:visits-calendar-expanded",
    false,
  );
  const expanded = isWide || expandedChoice;

  const selectDate = (next: string) => {
    setSearchParams(next === today ? {} : { date: next }, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="방문 일정"
        action={
          <Button asChild size="sm">
            <Link to={newVisitPath({ date })}>
              <Plus />
              방문 추가
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="lg:sticky lg:top-24">
          <ScheduleCalendar
            date={date}
            today={today}
            expanded={expanded}
            collapsible={!isWide}
            onToggleExpanded={toggleExpanded}
            onSelect={selectDate}
          />
        </div>
        <DayVisits date={date} today={today} />
      </div>
    </>
  );
}
