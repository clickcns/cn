import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useAuthStore } from "@/lib/api";

/** 로그아웃하면 AuthGuard가 로그인 화면으로 보낸다. */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout();
      } catch {
        // 서버 세션 정리에 실패해도(오프라인 등) 이 기기에서는 로그아웃한다.
      }
    },
    onSettled: () => {
      useAuthStore.getState().logout();
      queryClient.clear();
    },
  });
}
