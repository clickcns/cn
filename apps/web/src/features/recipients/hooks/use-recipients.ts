import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { recipientKeys } from "@/lib/query-keys";

/** 활성 수급자 목록(이름순). q가 있으면 이름으로 찾는다. */
export function useRecipients(q: string) {
  const query = { q: q.trim() || undefined };

  return useQuery({
    queryKey: recipientKeys.list(query),
    queryFn: () => api.recipients.list(query),
    // 검색어를 바꾸는 동안 이전 결과를 유지해 목록이 깜빡이지 않게 한다.
    placeholderData: keepPreviousData,
  });
}

export function useRecipient(id: string) {
  return useQuery({
    queryKey: recipientKeys.detail(id),
    queryFn: () => api.recipients.get(id),
    enabled: Boolean(id),
  });
}
