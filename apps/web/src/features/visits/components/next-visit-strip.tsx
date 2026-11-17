import {
  addKstDays,
  guardianNoticesAvailable,
  minutesFromNowText,
  planDay,
  type VisitStatus,
  type VisitSummary,
  type VisitUsualDuration,
} from "@repo/shared-types";
import { CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  NextVisitDetails,
  SlackBadge,
} from "@/features/visits/components/day-plan-parts";
import { GuardianNoticesButton } from "@/features/visits/components/guardian-notices-dialog";
import {
  useDailyVisits,
  useUsualDurations,
} from "@/features/visits/hooks/use-visits";
import { useNow } from "@/hooks/use-now";
import { formatDateLabel, formatTimeLabel } from "@/lib/date";
import { visitsPath } from "@/lib/routes";

/** 다음 방문 뒤로 보이는 예정 방문 수 */
const FOLLOWING = 2;
const NO_DURATIONS = new Map<string, VisitUsualDuration>();

/**
 * 오늘 일정 위의 "다음 방문" 줄: 아직 예정인 첫 방문(지났으면 "지금 차례"), 길 안내·기록 열기·늦음 안내,
 * 그다음 방문 두 건. 평소 방문 시간으로 앞 방문이 언제 끝날지 추정해 여유(이동 포함)를 매긴다(동선 1단계,
 * planDay). 건수는 서버가 센 statusCounts를 쓴다. 이 줄만 1분마다 다시 그린다.
 */
export function NextVisitStrip({
  visits,
  statusCounts,
  today,
}: {
  visits: readonly VisitSummary[];
  statusCounts: Record<VisitStatus, number>;
  today: string;
}) {
  const now = useNow();
  // 예정 방문이 남았을 때만 평소 방문 시간을 받는다
  const durations = useUsualDurations(
    today,
    visits,
    statusCounts.SCHEDULED > 0,
  );
  const plan = planDay(visits, durations ?? NO_DURATIONS, new Date(now));
  const upcoming = plan.filter((entry) => entry.phase === "UPCOMING");
  const drafts = statusCounts.DRAFT;
  const [next, ...rest] = upcoming;

  if (!next) {
    return (
      <section
        aria-label="오늘 남은 방문"
        className="bg-success-soft flex flex-col gap-3 rounded-2xl px-4 py-3"
      >
        <p className="text-success flex items-center gap-3 font-semibold">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          <span>
            오늘 방문을 모두 마쳤습니다
            {drafts > 0 && (
              <span className="text-foreground font-normal">
                {" "}
                · 확정 전 기록 {drafts}건
              </span>
            )}
          </span>
        </p>
        <TomorrowSummary today={today} />
      </section>
    );
  }

  // 평소 방문 시간을 받기 전에는 기본값으로 셈한 여유를 보이지 않는다(받은 뒤 바뀌어 깜박이지 않게).
  const planned = durations !== undefined;
  const risky = upcoming.filter((entry) => entry.status === "LATE").length;
  return (
    <section
      aria-label="다음 방문"
      className="border-primary/30 bg-primary-soft/50 flex flex-col gap-3 rounded-2xl border p-4"
    >
      <p className="text-primary -mb-2 flex items-center gap-1.5 text-sm font-bold">
        <Clock className="size-4" aria-hidden />
        {next.minutesFromNow < 0 ? "지금 차례" : "다음 방문"}
      </p>
      <NextVisitDetails entry={next} planned={planned} openLabel="기록 열기" />
      {rest.length > 0 && (
        <ul className="text-muted-foreground flex flex-col gap-1 border-t pt-2 text-sm">
          {rest.slice(0, FOLLOWING).map((entry) => (
            <li
              key={entry.visit.id}
              className="flex flex-wrap items-center gap-x-1.5"
            >
              <span>
                그다음{" "}
                <span className="text-foreground font-semibold tabular-nums">
                  {formatTimeLabel(entry.visit.scheduledAt)}
                </span>{" "}
                <span className="text-foreground">
                  {entry.visit.recipient.name}
                </span>{" "}
                · {minutesFromNowText(entry.minutesFromNow)}
              </span>
              {planned && <SlackBadge entry={entry} />}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-sm">
        남은 방문 {statusCounts.SCHEDULED}건
        {drafts > 0 && ` · 확정 전 기록 ${drafts}건`}
        {planned && risky > 0 && (
          <span className="text-destructive font-semibold">
            {" "}
            · 늦을 수 있는 방문 {risky}건
          </span>
        )}
      </p>
      {planned && (
        <p className="text-muted-foreground text-xs">
          여유는 앞 방문이 평소 시간대로 끝난다고 보고 센 값으로, 이동 시간이
          들어 있습니다.
        </p>
      )}
    </section>
  );
}

/** 오늘을 마친 뒤 내일 방문 요약: 건수·첫 방문, [내일 보기]·[보호자 안내 문자]. 내일 방문이 없으면 숨긴다. */
function TomorrowSummary({ today }: { today: string }) {
  const tomorrow = addKstDays(today, 1);
  // 내일 화면·보호자 안내 모아 보기와 같은 쿼리(캐시를 함께 쓴다)
  const summary = useDailyVisits(tomorrow).data;
  const first = summary?.items[0];
  if (!summary || !first) return null;
  return (
    <div className="border-success/20 flex flex-col gap-2 border-t pt-3">
      <p>
        <span className="font-semibold">내일 {formatDateLabel(tomorrow)}</span>{" "}
        방문 {summary.total}건 · 첫 방문{" "}
        <span className="tabular-nums">
          {formatTimeLabel(first.scheduledAt)}
        </span>{" "}
        {first.recipient.name}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to={visitsPath(tomorrow)}>
            <CalendarDays />
            내일 보기
          </Link>
        </Button>
        {guardianNoticesAvailable(
          tomorrow,
          summary.statusCounts.SCHEDULED,
          today,
        ) && <GuardianNoticesButton date={tomorrow} />}
      </div>
    </div>
  );
}
