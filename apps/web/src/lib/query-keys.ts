import type {
  RecipientListQuery,
  RecipientRecordQuery,
  SameDayWarningQuery,
  VisitCalendarQuery,
  VisitListQuery,
} from "@repo/shared-types";

/**
 * feature 경계를 넘어 공유되는 React Query 키.
 * 방문 저장 후 목록을 invalidate하는 식으로 서로의 캐시를 건드리므로 한곳에 모은다.
 */
const VISITS = ["visits"] as const;
const RECIPIENTS = ["recipients"] as const;

export const visitKeys = {
  all: VISITS,
  lists: () => [...VISITS, "list"] as const,
  list: (query: VisitListQuery) => [...VISITS, "list", query] as const,
  /** 달력(날짜별 건수). `lists` 접두어 아래라 저장·확정·삭제 뒤 목록과 함께 다시 받는다. */
  calendar: (query: VisitCalendarQuery) =>
    [...VISITS, "list", "calendar", query] as const,
  /**
   * 수급자의 지난 기록(useInfiniteQuery). `lists` 접두어 아래라 저장·확정·삭제·되돌리기 뒤
   * 목록과 함께 다시 받는다. cursor 는 키에 넣지 않는다.
   */
  pastRecords: (recipientId: string, query: RecipientRecordQuery) =>
    [...VISITS, "list", "records", recipientId, query] as const,
  /**
   * 그날 본인 방문의 평소 방문 시간. 확정 기록에서만 셈해 저장·확정으로 바뀌지 않으므로 `lists` 밖에 두고,
   * 그날 방문이 바뀔 때만(방문 id 목록이 키에 있다) 다시 받는다(받을 때마다 접속기록이 남는다).
   */
  usualDurations: (date: string, visitIds: string) =>
    [...VISITS, "usual-durations", date, visitIds] as const,
  detail: (id: string) => [...VISITS, "detail", id] as const,
  /** 방문 서식의 포털 입력 표시. 상세 아래라 확정·[수정] 뒤 상세와 함께 다시 받는다. */
  portalEntries: (id: string) =>
    [...VISITS, "detail", id, "portal-entries"] as const,
  sameDayWarnings: (query: SameDayWarningQuery) =>
    [...VISITS, "same-day-warnings", query] as const,
};

export const recipientKeys = {
  all: RECIPIENTS,
  list: (query: RecipientListQuery) => [...RECIPIENTS, "list", query] as const,
  detail: (id: string) => [...RECIPIENTS, "detail", id] as const,
};
