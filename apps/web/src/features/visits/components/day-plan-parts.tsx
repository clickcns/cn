import {
  minutesFromNowText,
  readyAfterText,
  slackText,
  type PlannedVisit,
  type PlanStatus,
  type VisitSummary,
} from "@repo/shared-types";
import { FileText } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapMenuButton } from "@/features/recipients/components/map-links";
import { LateNoticeButton } from "@/features/visits/components/late-notice-button";
import { formatTimeLabel } from "@/lib/date";
import { visitPath } from "@/lib/routes";

/*
 * 하루 동선(planDay) 표시 조각: 다음 방문 줄과 기록 화면의 다음 방문 카드가 함께 쓴다. 문구는
 * shared-types(day-plan.ts)에 있고 여기서는 그리기만 한다. "여유"는 이동 시간을 포함한 값이다.
 */

export type DayPlanEntry = PlannedVisit<VisitSummary>;

const SLACK_VARIANTS = {
  OK: "success",
  TIGHT: "warning",
  LATE: "destructive",
} as const satisfies Record<PlanStatus, "success" | "warning" | "destructive">;

/** 여유 표시: 여유 30분 / 빠듯함 · 여유 9분 / 늦을 수 있음 · 5분 */
export function SlackBadge({ entry }: { entry: DayPlanEntry }) {
  const text = slackText(entry);
  if (!entry.status || !text) return null;
  return (
    <Badge size="sm" variant={SLACK_VARIANTS[entry.status]}>
      {text}
    </Badge>
  );
}

/**
 * 예정 방문 하나: 시각·이름·남은 시간, 주소, 앞 방문 때문에 언제 갈 수 있는지와 여유, [지도]·[기록 열기]·
 * [늦음 안내]. planned가 false면(평소 방문 시간을 받기 전) 여유를 보이지 않는다.
 */
export function NextVisitDetails({
  entry,
  planned,
  openLabel,
  showReady = true,
}: {
  entry: DayPlanEntry;
  planned: boolean;
  openLabel: string;
  /** 앞 방문 까닭 줄(기록 화면에서 그 앞 방문이 지금 방문이면 끈다) */
  showReady?: boolean;
}) {
  const { visit } = entry;
  const { recipient } = visit;
  const overdue = entry.minutesFromNow < 0;
  const ready = planned && showReady ? readyAfterText(entry) : null;
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-bold">
          <span className="tabular-nums">
            {formatTimeLabel(visit.scheduledAt)}
          </span>{" "}
          {recipient.name}
          <span
            className={
              overdue
                ? "text-warning ml-2 text-base font-semibold"
                : "text-muted-foreground ml-2 text-base font-normal"
            }
          >
            {minutesFromNowText(entry.minutesFromNow)}
          </span>
        </p>
        {recipient.address && (
          <p className="text-muted-foreground line-clamp-2">
            {recipient.address}
          </p>
        )}
        {/* 지금 시각이 정한 여유는 남은 시간과 같으므로 앞 방문이 정했을 때만 */}
        {ready && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-muted-foreground text-sm">{ready}</p>
            <SlackBadge entry={entry} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {recipient.address && (
          <MapMenuButton
            address={recipient.address}
            label={`${recipient.name} 님 주소로 길 안내`}
          />
        )}
        <Button asChild size="sm" variant="soft">
          <Link to={visitPath(visit.id)}>
            <FileText />
            {openLabel}
          </Link>
        </Button>
        <LateNoticeButton
          entry={planned ? entry : { visit, slack: null, status: null }}
        />
      </div>
    </>
  );
}
