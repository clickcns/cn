import type {
  RecipientListQuery,
  UserListQuery,
  VisitListQuery,
} from "@repo/shared-types";

/**
 * React Query 키. 기능끼리 서로의 캐시를 무효화하므로 한곳에서 관리한다.
 * `all`은 해당 리소스의 모든 목록·상세를 한 번에 무효화할 때 쓴다.
 */
export const queryKeys = {
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
    detail: (id: string) => ["visits", "detail", id] as const,
  },
};
