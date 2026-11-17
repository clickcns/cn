import {
  activeVisitText,
  planDay,
  readyAfterText,
  type VisitDetail,
} from "@repo/shared-types";
import { TriangleAlert } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/features/auth/hooks/use-session";
import {
  NextVisitDetails,
  SlackBadge,
} from "@/features/visits/components/day-plan-parts";
import { LateNoticeButton } from "@/features/visits/components/late-notice-button";
import {
  useDailyVisits,
  useUsualDurations,
} from "@/features/visits/hooks/use-visits";
import { getVisitDate } from "@/features/visits/lib/record-form";
import { useNow, useToday } from "@/hooks/use-now";
import { formatTimeLabel } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * 기록 화면의 "다음 방문": 오늘 본인 방문을 끝냈으면(확정 또는 종료 시각 저장) 다음 예정 방문과 여유,
 * [지도]·[다음 기록 열기]·[늦음 안내]. 진행 중(시작 시각 저장)인 방문은 다음 방문이 빠듯하거나 늦을 수
 * 있을 때만 짧게 알린다(좁은 화면에서 기록 폼을 아래로 밀지 않게). 저장한 시각 기준이다.
 */
export function NextVisitCard({ visit }: { visit: VisitDetail }) {
  const today = useToday();
  const own = useCurrentUser()?.id === visit.staff.id;
  // 시작·종료 시각을 저장했거나 확정한 오늘 본인 방문만 — 그 전에는 하루 목록을 받지 않는다
  const begun =
    visit.status === "CONFIRMED" || Boolean(visit.startedAt ?? visit.endedAt);
  if (!own || !begun || getVisitDate(visit) !== today) return null;
  return <NextVisitPlan visit={visit} today={today} />;
}

const NO_VISITS: readonly { id: string }[] = [];

function NextVisitPlan({
  visit,
  today,
}: {
  visit: VisitDetail;
  today: string;
}) {
  const now = useNow();
  const daily = useDailyVisits(today).data;
  // 하루 목록을 받은 뒤, 예정 방문이 남았을 때만(받을 때마다 접속기록이 남는다)
  const durations = useUsualDurations(
    today,
    daily?.items ?? NO_VISITS,
    daily !== undefined && daily.statusCounts.SCHEDULED > 0,
  );
  if (!daily || !durations) return null;

  // 확정 직후 목록을 다시 받기 전에도 맞게, 이 방문은 상세의 상태·시각으로 바꿔 센다.
  const visits = daily.items.map((item) =>
    item.id === visit.id
      ? {
          ...item,
          status: visit.status,
          startedAt: visit.startedAt,
          endedAt: visit.endedAt,
        }
      : item,
  );
  const plan = planDay(visits, durations, new Date(now));
  const self = plan.find((entry) => entry.visit.id === visit.id);
  const next = plan.find((entry) => entry.phase === "UPCOMING");
  if (!self || !next) return null;

  if (self.phase === "ACTIVE") {
    if (next.status === "OK" || next.status === null) return null;
    // 여유를 정한 앞 방문이 이 방문이면 이 방문의 예상 끝, 아니면 그 앞 방문의 까닭
    const reason =
      next.readyAfter?.visit.id === visit.id
        ? activeVisitText(self)
        : readyAfterText(next);
    const late = next.status === "LATE";
    return (
      <Card
        className={cn(
          "gap-2",
          late ? "border-destructive/40" : "border-warning/40",
        )}
      >
        <p
          className={cn(
            "flex items-center gap-2 font-bold",
            late ? "text-destructive" : "text-warning",
          )}
        >
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          {late ? "다음 방문에 늦을 수 있어요" : "다음 방문이 빠듯해요"}
        </p>
        <p>
          <span className="font-semibold tabular-nums">
            {formatTimeLabel(next.visit.scheduledAt)}
          </span>{" "}
          {next.visit.recipient.name} 님{reason && ` · ${reason}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SlackBadge entry={next} />
          <LateNoticeButton entry={next} />
        </div>
      </Card>
    );
  }
  if (self.phase !== "DONE") return null;
  return (
    <Card className="gap-3">
      <CardTitle>다음 방문</CardTitle>
      <NextVisitDetails
        entry={next}
        planned
        openLabel="다음 기록 열기"
        showReady={next.readyAfter?.visit.id !== visit.id}
      />
    </Card>
  );
}
