import type {
  CreateVisitInput,
  SaveVisitRecordInput,
  VisitDetail,
} from "@repo/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { visitKeys } from "@/lib/query-keys";

/** 서버가 돌려준 최신 방문을 상세 캐시에 넣고 목록은 다시 받게 한다. */
function useSyncVisitCache() {
  const queryClient = useQueryClient();

  return (visit: VisitDetail) => {
    queryClient.setQueryData(visitKeys.detail(visit.id), visit);
    void queryClient.invalidateQueries({ queryKey: visitKeys.lists() });
  };
}

export function useCreateVisit() {
  const syncVisitCache = useSyncVisitCache();

  return useMutation({
    mutationFn: (input: CreateVisitInput) => api.visits.create(input),
    onSuccess: syncVisitCache,
  });
}

/** 기록 임시 저장. 저장하면 방문 상태가 "작성 중"이 된다. */
export function useSaveVisitRecord(visitId: string) {
  const syncVisitCache = useSyncVisitCache();

  return useMutation({
    mutationFn: (input: SaveVisitRecordInput) =>
      api.visits.saveRecord(visitId, input),
    onSuccess: syncVisitCache,
  });
}

/** 기록 확정. 확정 후에는 수정할 수 없다. */
export function useConfirmVisit(visitId: string) {
  const syncVisitCache = useSyncVisitCache();

  return useMutation({
    mutationFn: () => api.visits.confirm(visitId),
    onSuccess: syncVisitCache,
  });
}
