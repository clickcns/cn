import type {
  FormId,
  PortalEntry,
  PortalQueueQuery,
  PortalQueueResponse,
} from "@repo/shared-types";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** 확정했지만 포털에 넣었다고 표시하지 않은 서식(기본 기간: 지난달 1일부터 오늘까지). */
export function usePortalQueue(query: PortalQueueQuery) {
  return useQuery({
    queryKey: queryKeys.visits.portalQueue(query),
    queryFn: () => api.visits.portalQueue(query),
  });
}

/** 방문 서식의 포털 입력 표시. 방문을 고르기 전에는 묻지 않는다. */
export function usePortalEntries(visitId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.visits.portalEntries(visitId ?? ""),
    queryFn: () => api.visits.portalEntries(visitId!),
    enabled: !!visitId,
  });
}

/** 표시를 바꾼 뒤 받은 표시로 그 방문 캐시를 바꾼다. */
function setEntries(
  queryClient: QueryClient,
  visitId: string,
  entries: PortalEntry[],
) {
  queryClient.setQueryData(queryKeys.visits.portalEntries(visitId), entries);
}

interface PortalEntryTarget {
  visitId: string;
  formId: FormId;
}

export function useMarkPortalEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      visitId,
      formId,
      note,
    }: PortalEntryTarget & { note: string }) =>
      api.visits.markPortalEntry(visitId, formId, { note }),
    onSuccess: (entries, { visitId, formId }) => {
      setEntries(queryClient, visitId, entries);
      // 목록을 다시 받지 않고 그 서식만 뺀다(연달아 표시할 때 매번 목록 전체를 받지 않게).
      queryClient.setQueriesData<PortalQueueResponse>(
        { queryKey: queryKeys.visits.portalQueues },
        (queue) =>
          queue && {
            ...queue,
            items: queue.items.filter(
              (item) => item.visitId !== visitId || item.formId !== formId,
            ),
          },
      );
    },
  });
}

export function useUnmarkPortalEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, formId }: PortalEntryTarget) =>
      api.visits.unmarkPortalEntry(visitId, formId),
    onSuccess: (entries, { visitId }) => {
      setEntries(queryClient, visitId, entries);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.visits.portalQueues,
      });
    },
  });
}
