import type {
  RecipientListQuery,
  SameDayWarningQuery,
  UserListQuery,
  VisitCalendarQuery,
  VisitListQuery,
} from "@repo/shared-types";

/**
 * React Query 키. 기능끼리 서로의 캐시를 무효화하므로 한곳에서 관리한다.
 * `all`은 해당 리소스의 모든 목록·상세를 한 번에 무효화할 때 쓴다.
 */
export const queryKeys = {
  formLayouts: {
    all: ["form-layouts"] as const,
    list: () => ["form-layouts", "list"] as const,
    detail: (formId: string) => ["form-layouts", "detail", formId] as const,
    /** 미리보기 PDF. adjustments 는 정리한 조정의 JSON 글(같은 조정이면 같은 키). */
    preview: (formId: string, adjustments: string) =>
      ["form-layouts", "preview", formId, adjustments] as const,
  },
  organizations: {
    all: ["organizations"] as const,
    list: () => ["organizations", "list"] as const,
  },
  users: {
    all: ["users"] as const,
    list: (query: UserListQuery) => ["users", "list", query] as const,
  },
  recipients: {
    all: ["recipients"] as const,
    list: (query: RecipientListQuery) => ["recipients", "list", query] as const,
    detail: (id: string) => ["recipients", "detail", id] as const,
  },
  visits: {
    all: ["visits"] as const,
    lists: ["visits", "list"] as const,
    /**
     * "더 보기"로 이어 받는 목록(useInfiniteQuery). page·pageSize는 키에 넣지 않는다.
     * 일반 쿼리와 캐시 모양이 달라 키를 따로 두되, `lists` 접두어로 함께 무효화된다.
     */
    infiniteList: (query: Omit<VisitListQuery, "page" | "pageSize">) =>
      ["visits", "list", "infinite", query] as const,
    /** 목록 한 페이지(현황판처럼 앞의 몇 건과 전체 건수만 볼 때). */
    page: (query: VisitListQuery) => ["visits", "list", "page", query] as const,
    /** 달력 캐시 전부(조건별로 여러 개). */
    calendars: ["visits", "list", "calendar"] as const,
    /** 달력(날짜별 건수). `lists` 접두어 아래라 등록·삭제 뒤 목록과 함께 다시 받는다. */
    calendar: (query: VisitCalendarQuery) =>
      ["visits", "list", "calendar", query] as const,
    /** calendar()로 만든 키에서 조건을 꺼낸다(캐시를 고칠 때). */
    calendarQueryOf: (key: readonly unknown[]) =>
      key[3] as VisitCalendarQuery | undefined,
    detail: (id: string) => ["visits", "detail", id] as const,
    /** 확정본 이력. 상세 아래라 상세와 함께 무효화된다. */
    versions: (id: string) => ["visits", "detail", id, "versions"] as const,
    /** 확정본 한 벌. 상세 아래라 상세와 함께 무효화된다. */
    version: (id: string, version: number) =>
      ["visits", "detail", id, "version", version] as const,
    sameDayWarningsAll: ["visits", "same-day-warnings"] as const,
    sameDayWarnings: (query: SameDayWarningQuery) =>
      ["visits", "same-day-warnings", query] as const,
  },
};
