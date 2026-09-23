import { getErrorMessage } from "@repo/api-client";
import type { LoginInput } from "@repo/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, useAuthStore } from "@/lib/api";

/**
 * 로그인. 성공하면 세션을 한 번에 저장하고, 화면 이동은 GuestGuard가 맡는다.
 * 관리 웹을 쓸 수 없는 역할은 서버가 세션을 만들기 전에 403으로 거절한다.
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.auth.login({ ...input, client: "ADMIN_WEB" }),
    onSuccess: (session) => {
      // 이전 사용자의 캐시가 보이지 않도록 비운다.
      queryClient.clear();
      useAuthStore.getState().setSession(session);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "로그인하지 못했습니다"));
    },
  });
}
