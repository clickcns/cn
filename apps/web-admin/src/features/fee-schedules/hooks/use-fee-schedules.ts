import { getErrorMessage } from "@repo/api-client";
import type {
  CreateHomeCareFeeScheduleInput,
  HomeCareFeeScheduleList,
} from "@repo/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** 수가 묶음 목록(코드 기본값 + 넣은 묶음, 시행 월 늦은 순, 지운 것 포함). */
export function useFeeSchedules() {
  return useQuery({
    queryKey: queryKeys.feeSchedules.all,
    queryFn: () => api.feeSchedules.list(),
  });
}

/**
 * 넣기·지우기. 서버가 목록 전체를 돌려주므로 그대로 캐시에 넣고, 금액이 바뀌는 재택의료 수입을
 * 다시 받는다. 실패는 알림으로 알린다.
 */
function useFeeScheduleMutation<V>(
  request: (variables: V) => Promise<HomeCareFeeScheduleList>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (list) => {
      queryClient.setQueryData(queryKeys.feeSchedules.all, list);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.visits.homeCareMonths,
      });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export const useCreateFeeSchedule = () =>
  useFeeScheduleMutation((input: CreateHomeCareFeeScheduleInput) =>
    api.feeSchedules.create(input),
  );

export const useRemoveFeeSchedule = () =>
  useFeeScheduleMutation((id: string) => api.feeSchedules.remove(id));
