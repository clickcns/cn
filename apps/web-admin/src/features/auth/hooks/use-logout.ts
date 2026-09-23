import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useOrganizationScopeStore } from "@/features/organizations/stores/use-organization-scope-store";
import { api, useAuthStore } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

/** 서버 로그아웃이 실패해도(네트워크 등) 이 기기의 세션은 반드시 지운다. */
export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      useAuthStore.getState().logout();
      useOrganizationScopeStore.getState().setOrganizationId(null);
      navigate(ROUTES.login, { replace: true });
      queryClient.clear();
    },
  });
}
