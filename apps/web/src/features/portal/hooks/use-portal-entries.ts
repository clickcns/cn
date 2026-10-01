import type { FormId } from "@repo/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { visitKeys } from "@/lib/query-keys";

export function usePortalEntries(visitId: string) {
  return useQuery({
    queryKey: visitKeys.portalEntries(visitId),
    queryFn: () => api.visits.portalEntries(visitId),
  });
}

/** 서식 하나를 포털에 넣었다고 표시(다시 누르면 시각·메모를 새로). */
export function useMarkPortalEntry(visitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formId, note }: { formId: FormId; note: string }) =>
      api.visits.markPortalEntry(visitId, formId, { note }),
    onSuccess: (entries) =>
      queryClient.setQueryData(visitKeys.portalEntries(visitId), entries),
  });
}

export function useUnmarkPortalEntry(visitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formId: FormId) =>
      api.visits.unmarkPortalEntry(visitId, formId),
    onSuccess: (entries) =>
      queryClient.setQueryData(visitKeys.portalEntries(visitId), entries),
  });
}
