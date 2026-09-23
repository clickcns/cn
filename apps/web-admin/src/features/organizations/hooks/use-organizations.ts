import { getErrorMessage } from "@repo/api-client";
import type {
  CreateOrganizationInput,
  Program,
  UpdateOrganizationInput,
} from "@repo/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useCurrentUser,
  useIsAdmin,
} from "@/features/auth/hooks/use-current-user";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** 기관 목록. 운영자(ADMIN) 전용 API라 다른 역할은 호출하지 않는다. */
export function useOrganizations() {
  const isAdmin = useIsAdmin();
  return useQuery({
    queryKey: queryKeys.organizations.list(),
    queryFn: () => api.organizations.list(),
    enabled: isAdmin,
  });
}

/** 기관 id → 이름. 운영자가 "전체 기관"을 볼 때 기관 열을 채우는 데 쓴다. */
export function useOrganizationNameMap(): Map<string, string> {
  const { data } = useOrganizations();
  return new Map((data ?? []).map((org) => [org.id, org.name]));
}

/**
 * 기관 id → 그 기관이 하는 사업. 운영자는 기관 목록에서, 기관 관리자는 로그인 정보(자기 기관)에서 읽는다.
 */
export function useOrganizationPrograms(): (
  organizationId: string | undefined,
) => Program[] {
  const isAdmin = useIsAdmin();
  const user = useCurrentUser();
  const { data } = useOrganizations();
  return (organizationId) => {
    if (!organizationId) return [];
    if (!isAdmin) {
      return organizationId === user?.organizationId ? user.programs : [];
    }
    return data?.find((org) => org.id === organizationId)?.programs ?? [];
  };
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      api.organizations.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.all,
      });
      toast.success("기관을 등록했습니다");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateOrganizationInput;
    }) => api.organizations.update(id, input),
    onSuccess: async () => {
      // 사용자 목록에 기관 이름이 함께 나온다.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organizations.all,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
      ]);
      toast.success("기관 정보를 수정했습니다");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
