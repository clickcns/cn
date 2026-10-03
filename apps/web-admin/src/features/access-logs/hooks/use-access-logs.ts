import type { AccessLogQuery } from "@repo/shared-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** 접속기록 한 쪽. 조건을 바꾸는 동안에는 이전 쪽을 보인다. */
export function useAccessLogs(query: AccessLogQuery) {
  return useQuery({
    queryKey: queryKeys.accessLogs.list(query),
    queryFn: () => api.accessLogs.list(query),
    placeholderData: keepPreviousData,
  });
}
