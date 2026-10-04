import {
  formatMinutes,
  upcomingVisits,
  type VisitStatus,
  type VisitSummary,
} from "@repo/shared-types";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { MapMenuButton } from "@/features/recipients/components/map-links";
import { useNow } from "@/hooks/use-now";
import { formatTimeLabel } from "@/lib/date";
import { visitPath } from "@/lib/routes";

/** 다음 방문 뒤로 보이는 예정 방문 수 */
const FOLLOWING = 2;

/** "40분 후", "1시간 5분 후" / 지났으면 "예정 시각 20분 지남" */
function untilText(minutes: number): string {
  if (minutes >= 0)
    return minutes === 0 ? "지금" : `${formatMinutes(minutes)} 후`;
  return `예정 시각 ${formatMinutes(-minutes)} 지남`;
}

/**
 * 오늘 일정 위의 "다음 방문" 줄: 아직 예정인 첫 방문(지났으면 "지금 차례"), 길 안내·기록 열기, 그다음
 * 방문 두 건. 건수는 서버가 센 statusCounts를 쓴다. 이 줄만 1분마다 다시 그린다.
 */
export function NextVisitStrip({
  visits,
  statusCounts,
}: {
  visits: readonly VisitSummary[];
  statusCounts: Record<VisitStatus, number>;
}) {
  const now = useNow();
  const upcoming = upcomingVisits(visits, new Date(now));
  const drafts = statusCounts.DRAFT;
  const [next, ...rest] = upcoming;

  if (!next) {
    return (
      <section
        aria-label="오늘 남은 방문"
        className="bg-success-soft text-success flex items-center gap-3 rounded-2xl px-4 py-3"
      >
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        <p className="font-semibold">
          오늘 방문을 모두 마쳤습니다
          {drafts > 0 && (
            <span className="text-foreground font-normal">
              {" "}
              · 확정 전 기록 {drafts}건
            </span>
          )}
        </p>
      </section>
    );
  }

  const { visit } = next;
  const overdue = next.minutesFromNow < 0;
  return (
    <section
      aria-label="다음 방문"
      className="border-primary/30 bg-primary-soft/50 flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex flex-col gap-1">
        <p className="text-primary flex items-center gap-1.5 text-sm font-bold">
          <Clock className="size-4" aria-hidden />
          {overdue ? "지금 차례" : "다음 방문"}
        </p>
        <p className="text-lg font-bold">
          <span className="tabular-nums">
            {formatTimeLabel(visit.scheduledAt)}
          </span>{" "}
          {visit.recipient.name}
          <span
            className={
              overdue
                ? "text-warning ml-2 text-base font-semibold"
                : "text-muted-foreground ml-2 text-base font-normal"
            }
          >
            {untilText(next.minutesFromNow)}
          </span>
        </p>
        {visit.recipient.address && (
          <p className="text-muted-foreground line-clamp-2">
            {visit.recipient.address}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {visit.recipient.address && (
          <MapMenuButton
            address={visit.recipient.address}
            label={`${visit.recipient.name} 님 주소로 길 안내`}
          />
        )}
        <Button asChild size="sm" variant="soft">
          <Link to={visitPath(visit.id)}>
            <FileText />
            기록 열기
          </Link>
        </Button>
      </div>
      {rest.length > 0 && (
        <ul className="text-muted-foreground flex flex-col gap-0.5 border-t pt-2 text-sm">
          {rest.slice(0, FOLLOWING).map((item) => (
            <li key={item.visit.id}>
              그다음{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {formatTimeLabel(item.visit.scheduledAt)}
              </span>{" "}
              <span className="text-foreground">
                {item.visit.recipient.name}
              </span>{" "}
              · {untilText(item.minutesFromNow)}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-sm">
        남은 방문 {statusCounts.SCHEDULED}건
        {drafts > 0 && ` · 확정 전 기록 ${drafts}건`}
      </p>
    </section>
  );
}
