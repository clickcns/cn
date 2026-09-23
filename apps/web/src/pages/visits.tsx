import { formatKstDate, isIsoDate } from "@repo/shared-types";
import { CalendarX2, Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, PageError, PageLoading } from "@/components/ui/page-state";
import { DateNavigator } from "@/features/visits/components/date-navigator";
import { VisitCard } from "@/features/visits/components/visit-card";
import { useDailyVisits } from "@/features/visits/hooks/use-visits";
import { newVisitPath } from "@/lib/routes";

export default function VisitsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = formatKstDate();
  const dateParam = searchParams.get("date");
  const date = isIsoDate(dateParam) ? dateParam : today;

  const visitsQuery = useDailyVisits(date);
  const visits = visitsQuery.data?.items ?? [];
  // 건수는 서버가 조건 전체 기준으로 센 값을 쓴다.
  const total = visitsQuery.data?.total ?? 0;
  const confirmedCount = visitsQuery.data?.statusCounts.CONFIRMED ?? 0;

  const changeDate = (next: string) => {
    setSearchParams(next === today ? {} : { date: next }, { replace: true });
  };

  const addVisitLink = newVisitPath({ date });

  return (
    <>
      <PageHeader
        title="방문 일정"
        action={
          <Button asChild size="sm">
            <Link to={addVisitLink}>
              <Plus />
              방문 추가
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <DateNavigator date={date} today={today} onChange={changeDate} />

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
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {visits.map((visit) => (
                <li key={visit.id}>
                  <VisitCard visit={visit} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
