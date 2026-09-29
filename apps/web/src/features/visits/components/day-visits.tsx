import { CalendarX2, Plus } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { EmptyState, PageError, PageLoading } from "@/components/ui/page-state";
import { VisitCard } from "@/features/visits/components/visit-card";
import { useDailyVisits } from "@/features/visits/hooks/use-visits";
import { formatDateLabel, relativeDayLabel } from "@/lib/date";
import { newVisitPath } from "@/lib/routes";

interface DayVisitsProps {
  date: string;
  today: string;
}

/** 달력에서 고른 날의 방문 일정(카드 목록). */
export function DayVisits({ date, today }: DayVisitsProps) {
  const visitsQuery = useDailyVisits(date);
  const visits = visitsQuery.data?.items ?? [];
  // 건수는 서버가 조건 전체 기준으로 센 값을 쓴다.
  const total = visitsQuery.data?.total ?? 0;
  const confirmedCount = visitsQuery.data?.statusCounts.CONFIRMED ?? 0;
  const addVisitLink = newVisitPath({ date });
  const relative = relativeDayLabel(date, today);

  return (
    <section className="flex flex-col gap-3" aria-label="고른 날의 방문">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold" aria-live="polite">
          {formatDateLabel(date)}
          {relative && (
            <span className="text-primary ml-2 text-base">{relative}</span>
          )}
        </h2>
        <Button asChild size="sm" variant="soft">
          <Link to={addVisitLink}>
            <Plus />이 날 방문 추가
          </Link>
        </Button>
      </div>

      {visitsQuery.isPending ? (
        <PageLoading />
      ) : visitsQuery.isError ? (
        <PageError
          error={visitsQuery.error}
          fallback="방문 일정을 불러오지 못했습니다"
          onRetry={() => void visitsQuery.refetch()}
        />
      ) : visits.length === 0 ? (
        <EmptyState
          icon={<CalendarX2 />}
          title="이 날짜에 예정된 방문이 없습니다"
          description="방문을 추가하면 여기에 표시됩니다."
          action={
            <Button asChild>
              <Link to={addVisitLink}>
                <Plus />
                방문 추가
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-muted-foreground" aria-live="polite">
            방문 <strong className="text-foreground">{total}건</strong>
            {" · "}확정 {confirmedCount}건
          </p>
          {/* 넓은 화면에서는 달력 옆 좁은 칸이라 한 줄로 쌓는다. */}
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1">
            {visits.map((visit) => (
              <li key={visit.id}>
                <VisitCard visit={visit} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
