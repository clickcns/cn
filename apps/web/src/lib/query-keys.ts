import type { RecipientListQuery, VisitListQuery } from "@repo/shared-types";

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
  detail: (id: string) => [...VISITS, "detail", id] as const,
};

export const recipientKeys = {
  all: RECIPIENTS,
  list: (query: RecipientListQuery) => [...RECIPIENTS, "list", query] as const,
  detail: (id: string) => [...RECIPIENTS, "detail", id] as const,
};
