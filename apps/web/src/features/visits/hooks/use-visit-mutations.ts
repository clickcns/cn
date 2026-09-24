import type {
  CreateVisitInput,
  SaveVisitRecordInput,
  UpdateVisitFormsInput,
  VisitDetail,
} from "@repo/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dictationKey } from "@/features/dictation/hooks/use-dictation";
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

/**
 * 선택 서식 켜고 끄기(확정 전). 뺀 서식은 서버가 저장 값과 구술 초안에서도 지우므로 구술도 다시 받는다.
 */
export function useUpdateVisitForms(visitId: string) {
  const queryClient = useQueryClient();
  const syncVisitCache = useSyncVisitCache();

  return useMutation({
    mutationFn: (input: UpdateVisitFormsInput) =>
      api.visits.updateForms(visitId, input),
    onSuccess: (visit) => {
      syncVisitCache(visit);
      void queryClient.invalidateQueries({ queryKey: dictationKey(visitId) });
    },
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
