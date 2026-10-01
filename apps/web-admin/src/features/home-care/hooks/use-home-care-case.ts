import { getErrorMessage } from "@repo/api-client";
import type { HomeCareCase } from "@repo/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** 수급자 한 명의 재택의료 사례 정보. */
export function useHomeCareCase(recipientId: string) {
  return useQuery({
    queryKey: queryKeys.recipients.homeCareCase(recipientId),
    queryFn: () => api.recipients.homeCareCase(recipientId),
  });
}

/**
 * 사례 정보를 바꾸는 요청. 서버가 사례 정보 전체를 돌려주므로 그대로 캐시에 넣고, 판정이 바뀌는
 * 재택의료 수입은 지금 다시 받지 않고 낡음으로만 표시한다(창을 닫을 때 refreshHomeCareMonths로
 * 한 번 받는다 — 창에서 여러 번 고쳐도 한 번만). 실패는 알림으로 알린다.
 */
export function useHomeCareCaseMutation<V>(
  recipientId: string,
  request: (variables: V) => Promise<HomeCareCase>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (homeCareCase) => {
      queryClient.setQueryData(
        queryKeys.recipients.homeCareCase(recipientId),
        homeCareCase,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.visits.homeCareMonths,
        refetchType: "none",
      });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/** 사례 정보 창을 닫을 때: 창에서 고쳐 낡음 표시한 재택의료 수입(지금 보이는 것)만 다시 받는다. */
export function useRefreshHomeCareMonths() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.refetchQueries({
      queryKey: queryKeys.visits.homeCareMonths,
      type: "active",
      predicate: (query) => query.state.isInvalidated,
    });
}
