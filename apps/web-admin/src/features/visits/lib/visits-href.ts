import type { VisitFilters } from "@/features/visits/hooks/use-visit-filters";
import { ROUTES } from "@/lib/routes";

/**
 * 방문 목록 화면이 읽는 쿼리스트링: 필터(use-visit-filters)와 보기·달·고른 날·수급자
 * (use-visit-view). 이름을 여기서 묶어 두어 틀린 이름이면 컴파일 오류가 난다.
 */
export type VisitsSearch = Partial<
  Record<keyof VisitFilters | "view" | "month" | "day" | "recipient", string>
>;

/** 방문 목록·달력 주소. 값이 없는 조건은 뺀다. */
export function visitsHref(search: VisitsSearch): string {
  const params = new URLSearchParams(
    Object.entries(search).filter(
      (entry): entry is [string, string] => !!entry[1],
    ),
  ).toString();
  return params ? `${ROUTES.visits}?${params}` : ROUTES.visits;
}
