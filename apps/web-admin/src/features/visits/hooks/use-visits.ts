import { getErrorMessage } from "@repo/api-client";
import {
  emptyStatusCounts,
  type CreateVisitInput,
  type SameDayWarningQuery,
  type UpdateVisitInput,
  type VisitCalendarQuery,
  type VisitCalendarResponse,
  type VisitListQuery,
  type VisitListResponse,
  type VisitOrganizationCount,
  type VisitStatus,
  type VisitSummary,
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
import { moveCalendarVisit } from "@/features/visits/lib/calendar-items";
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
  /** 기관 id → 건수. groupBy=organization으로 받았을 때만 있다(첫 페이지 응답 기준). */
  organizationCounts: ReadonlyMap<string, VisitOrganizationCount> | undefined;
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
    statusCounts: first?.statusCounts ?? emptyStatusCounts(),
    organizationCounts: first?.organizationCounts
      ? new Map(
          first.organizationCounts.map((count) => [
            count.organizationId,
            count,
          ]),
        )
      : undefined,
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

/** 방문 목록 한 페이지. 현황판처럼 앞의 몇 건과 조건 전체 건수(total)만 볼 때 쓴다. */
export function useVisitPage(query: VisitListQuery) {
  return useQuery({
    queryKey: queryKeys.visits.page(query),
    queryFn: () => api.visits.list(query),
  });
}

/**
 * 방문 달력(날짜별 상태 건수). 필터는 목록과 같다.
 * 달을 넘기는 동안에는 이전 달 숫자를 두어 칸이 깜박이지 않게 한다.
 */
export function useVisitCalendar(query: VisitCalendarQuery) {
  return useQuery({
    queryKey: queryKeys.visits.calendar(query),
    queryFn: () => api.visits.calendar(query),
    placeholderData: keepPreviousData,
  });
}

export function useVisit(id: string) {
  return useQuery({
    queryKey: queryKeys.visits.detail(id),
    queryFn: () => api.visits.get(id),
  });
}

/** 확정본 이력(1차, 2차 …). 확정한 적이 없으면(enabled false) 묻지 않는다. */
export function useVisitVersions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.visits.versions(id),
    queryFn: () => api.visits.versions(id),
    enabled,
  });
}

/** 확정본 한 벌(1차, 2차 …). version이 null이면 묻지 않는다. */
export function useVisitVersion(id: string, version: number | null) {
  return useQuery({
    queryKey: queryKeys.visits.version(id, version ?? 0),
    queryFn: () => api.visits.version(id, version!),
    enabled: version !== null,
  });
}

/** 만들려는 방문의 같은 날 경고. 조건을 다 고르기 전(null)에는 묻지 않는다. */
export function useSameDayWarnings(query: SameDayWarningQuery | null) {
  return useQuery({
    queryKey: queryKeys.visits.sameDayWarnings(query!),
    queryFn: () => api.visits.sameDayWarnings(query!),
    enabled: query !== null,
    select: (response) => response.warnings,
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
 * 방문 일정·담당자 바꾸기. 일정을 옮기면 달력 캐시를 먼저 바꿔(낙관적 업데이트)
 * 끌어다 놓은 칩이 바로 옮겨 보이게 하고, 실패하면 되돌린다.
 * 성공·실패 문구는 부르는 쪽이 정한다(끌어다 놓기는 되돌리기 버튼을 붙인다).
 */
export function useUpdateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVisitInput }) =>
      api.visits.update(id, input),
    onMutate: async ({ id, input }) => {
      const { scheduledAt } = input;
      if (!scheduledAt) return { previous: [] };
      await queryClient.cancelQueries({ queryKey: queryKeys.visits.calendars });
      const previous = queryClient.getQueriesData<VisitCalendarResponse>({
        queryKey: queryKeys.visits.calendars,
      });
      for (const [key, data] of previous) {
        const query = queryKeys.visits.calendarQueryOf(key);
        queryClient.setQueryData(
          key,
          moveCalendarVisit(data, query, id, scheduledAt),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (visit) => {
      queryClient.setQueryData(queryKeys.visits.detail(visit.id), visit);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.visits.lists }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.visits.sameDayWarningsAll,
        }),
      ]),
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
