import type { VisitStatus } from "./visit.js";

/*
 * 하루 일정의 "다음 방문": 아직 예정인 방문과 지금부터 몇 분 남았는지(지났으면 음수). 방문은 목록 API
 * 순서(예정 시각순) 그대로 받는다. 건수는 여기서 세지 않는다(화면은 서버의 statusCounts를 쓴다).
 */

export interface UpcomingVisit<T> {
  visit: T;
  /** 지금부터 예정 시각까지(분, 반올림). 지났으면 음수 */
  minutesFromNow: number;
}

export function upcomingVisits<
  T extends { status: VisitStatus; scheduledAt: string },
>(visits: readonly T[], now: Date): UpcomingVisit<T>[] {
  return visits
    .filter((visit) => visit.status === "SCHEDULED")
    .map((visit) => ({
      visit,
      minutesFromNow: Math.round(
        (new Date(visit.scheduledAt).getTime() - now.getTime()) / 60_000,
      ),
    }));
}
