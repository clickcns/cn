import {
  countVisitsByDay,
  formatKstDate,
  formatKstTime,
  type VisitCalendarItem,
  type VisitCalendarQuery,
  type VisitCalendarResponse,
  type VisitStaff,
  type VisitStatus,
} from "@repo/shared-types";

/**
 * 빠른 보기 창에 넘기는 방문. 달력 칩(VisitCalendarItem)과 표 행(VisitSummary)이
 * 모두 이 모양을 만족한다.
 */
export interface QuickViewVisit {
  id: string;
  organizationId: string;
  program: VisitCalendarItem["program"];
  status: VisitStatus;
  scheduledAt: string;
  formIds: VisitCalendarItem["formIds"];
  recipient: VisitCalendarItem["recipient"];
  staff: VisitStaff;
}

/** 방문의 한국 날짜(YYYY-MM-DD). */
export function visitDate(visit: { scheduledAt: string }): string {
  return formatKstDate(new Date(visit.scheduledAt));
}

/** 방문 시각 "09:30"(한국 시간). */
export function visitTime(visit: { scheduledAt: string }): string {
  return formatKstTime(new Date(visit.scheduledAt));
}

/** 방문을 한국 날짜별로 묶는다(받은 순서 = 일시 오름차순을 지킨다). */
export function groupByDay(
  items: readonly VisitCalendarItem[],
): Map<string, VisitCalendarItem[]> {
  const byDay = new Map<string, VisitCalendarItem[]>();
  for (const item of items) {
    const date = visitDate(item);
    const list = byDay.get(date);
    if (list) list.push(item);
    else byDay.set(date, [item]);
  }
  return byDay;
}

/**
 * 칸에 바로 보여 줄 칩 수. 4건까지는 모두, 그보다 많으면 3건과 "+N".
 * ("+1"만 남기느니 네 번째 칩을 보여 주는 편이 낫다.)
 */
export function visibleChipCount(total: number): number {
  return total <= 4 ? total : 3;
}

/**
 * 낙관적 업데이트: 캐시된 달력 응답에서 한 방문의 일시를 바꾸고 날짜별 건수를 다시 센다.
 * 옮긴 날짜가 그 달력의 범위를 벗어나면 목록에서 뺀다. 방문 목록이 없는 응답(상한 초과)은 그대로 둔다.
 */
export function moveCalendarVisit(
  data: VisitCalendarResponse | undefined,
  query: VisitCalendarQuery | undefined,
  id: string,
  scheduledAt: string,
): VisitCalendarResponse | undefined {
  if (!data?.visits || !data.visits.some((item) => item.id === id)) {
    return data;
  }
  const date = formatKstDate(new Date(scheduledAt));
  const inRange = !query || (query.from <= date && date <= query.to);
  const visits = data.visits
    .flatMap((item) => {
      if (item.id !== id) return [item];
      return inRange ? [{ ...item, scheduledAt }] : [];
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime() ||
        (a.id < b.id ? -1 : 1),
    );
  return { ...data, visits, days: countVisitsByDay(visits) };
}
