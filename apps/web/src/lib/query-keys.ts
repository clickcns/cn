import type {
  RecipientListQuery,
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
  detail: (id: string) => [...VISITS, "detail", id] as const,
  sameDayWarnings: (query: SameDayWarningQuery) =>
    [...VISITS, "same-day-warnings", query] as const,
};

export const recipientKeys = {
  all: RECIPIENTS,
  list: (query: RecipientListQuery) => [...RECIPIENTS, "list", query] as const,
  detail: (id: string) => [...RECIPIENTS, "detail", id] as const,
};
