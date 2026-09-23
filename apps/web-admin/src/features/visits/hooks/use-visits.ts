import { getErrorMessage } from "@repo/api-client";
import type {
  CreateVisitInput,
  VisitListQuery,
  VisitListResponse,
  VisitStatus,
  VisitSummary,
} from "@repo/shared-types";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** 방문 목록을 한 번에 받는 건수("더 보기" 한 번). */
const VISIT_LIST_PAGE_SIZE = 100;

/** 방문 목록 조건. 페이지는 훅이 정한다. */
export type VisitListFilter = Omit<VisitListQuery, "page" | "pageSize">;

export interface VisitList {
  /** 지금까지 받은 방문(방문 일시 오름차순) */
  items: VisitSummary[];
  /** 조건에 맞는 전체 건수(첫 페이지 응답 기준) */
  total: number;
  /** 조건에 맞는 방문의 상태별 건수(첫 페이지 응답 기준) */
  statusCounts: Record<VisitStatus, number>;
}

function toVisitList({
  pages,
}: InfiniteData<VisitListResponse, number>): VisitList {
  // 페이지를 받는 사이에 방문이 추가·삭제되면 경계의 방문이 두 페이지에 걸칠 수 있다.
  const seen = new Set<string>();
  const items: VisitSummary[] = [];
  for (const page of pages) {
    for (const visit of page.items) {
      if (seen.has(visit.id)) continue;
      seen.add(visit.id);
      items.push(visit);
    }
  }
  const [first] = pages;
  return {
    items,
    total: first?.total ?? 0,
    statusCounts: first?.statusCounts ?? {
      SCHEDULED: 0,
      DRAFT: 0,
      CONFIRMED: 0,
    },
  };
}

/**
 * 방문 목록. 첫 페이지를 받고 "더 보기"(fetchNextPage)로 이어 받는다.
 * 조건이 쿼리 키에 들어가므로 조건이 바뀌면 첫 페이지부터 다시 받는다.
 */
export function useInfiniteVisits(
  filter: VisitListFilter,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: queryKeys.visits.infiniteList(filter),
    queryFn: ({ pageParam }) =>
      api.visits.list({
        ...filter,
        page: pageParam,
        pageSize: VISIT_LIST_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      // 빈 페이지가 오면(그사이 방문이 지워짐) 더 받지 않는다.
      return lastPage.items.length > 0 && loaded < lastPage.total
        ? lastPage.page + 1
        : undefined;
    },
    select: toVisitList,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useVisit(id: string) {
  return useQuery({
    queryKey: queryKeys.visits.detail(id),
    queryFn: () => api.visits.get(id),
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVisitInput) => api.visits.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.visits.all });
      toast.success("방문을 등록했습니다");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/**
 * 예정(SCHEDULED) 상태의 방문만 지울 수 있다. 그 밖에는 서버가 409를 돌려준다.
 * 상세 캐시는 여기서 지우지 않는다. 상세 화면이 떠 있는 동안 지우면 곧바로 다시 조회해
 * 404가 잠깐 보이므로, 화면을 떠난 뒤 호출하는 쪽에서 지운다.
 */
export function useDeleteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.visits.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.visits.lists });
      toast.success("방문을 삭제했습니다");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
