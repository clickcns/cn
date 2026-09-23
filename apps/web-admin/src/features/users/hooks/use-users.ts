import { getErrorMessage } from "@repo/api-client";
import {
  canBeAssignedVisits,
  type CreateUserInput,
  type UpdateUserInput,
  type UserListQuery,
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

export function useUsers(query: UserListQuery) {
  return useQuery({
    queryKey: queryKeys.users.list(query),
    queryFn: () => api.users.list(query),
    placeholderData: keepPreviousData,
  });
}

/**
 * 방문을 맡길 수 있는 사용자(직종이 있는 현장 직원·기관 관리자).
 * includeInactive면 비활성 계정도 포함한다(필터에서 지난 방문 담당자를 고를 때).
 */
export function useVisitStaff(
  organizationId: string | undefined,
  { includeInactive = false }: { includeInactive?: boolean } = {},
) {
  const query = useUsers({ organizationId });
  const staff = (query.data ?? []).filter(
    (user) => canBeAssignedVisits(user) && (includeInactive || user.isActive),
  );
  return { ...query, staff };
}

function invalidateUserRelated(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    // 기관 목록의 사용자 수, 방문 목록의 담당자 이름이 바뀔 수 있다.
    queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.visits.all }),
  ]);
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api.users.create(input),
    onSuccess: async () => {
      await invalidateUserRelated(queryClient);
      toast.success("사용자를 추가했습니다");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateUser({ successMessage }: { successMessage: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      api.users.update(id, input),
    onSuccess: async () => {
      await invalidateUserRelated(queryClient);
      toast.success(successMessage);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
