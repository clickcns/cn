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

/** 기록 확정. 확정한 기록은 [수정](useReopenVisit)으로 작성 중으로 되돌려야 고칠 수 있다. */
export function useConfirmVisit(visitId: string) {
  const syncVisitCache = useSyncVisitCache();

  return useMutation({
    mutationFn: () => api.visits.confirm(visitId),
    onSuccess: syncVisitCache,
  });
}

/** 예정 방문 삭제. 기록이 생긴 방문은 서버가 막는다(409). 목록은 다시 받는다. */
export function useDeleteVisit(visitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.visits.remove(visitId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: visitKeys.lists() });
    },
  });
}

/** 확정한 기록을 작성 중으로 되돌린다(담당자 본인). 되돌리면 기록 폼으로 바뀐다. */
export function useReopenVisit(visitId: string) {
  const syncVisitCache = useSyncVisitCache();

  return useMutation({
    mutationFn: () => api.visits.reopen(visitId),
    onSuccess: syncVisitCache,
  });
}
