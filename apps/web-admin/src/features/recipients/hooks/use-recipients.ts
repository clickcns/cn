import { getErrorMessage } from "@repo/api-client";
import type {
  CreateRecipientInput,
  RecipientListQuery,
  UpdateRecipientInput,
} from "@repo/shared-types";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useRecipients(query: RecipientListQuery) {
  return useQuery({
    queryKey: queryKeys.recipients.list(query),
    queryFn: () => api.recipients.list(query),
    placeholderData: keepPreviousData,
  });
}

function invalidateRecipientRelated(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.recipients.all }),
    // 기관 목록의 수급자 수, 방문 목록·상세의 수급자 정보가 바뀔 수 있다.
    queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.visits.all }),
  ]);
}

export function useCreateRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRecipientInput) => api.recipients.create(input),
    onSuccess: async () => {
      await invalidateRecipientRelated(queryClient);
      toast.success("수급자를 등록했습니다");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRecipientInput }) =>
      api.recipients.update(id, input),
    onSuccess: async () => {
      await invalidateRecipientRelated(queryClient);
      toast.success("수급자 정보를 수정했습니다");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
