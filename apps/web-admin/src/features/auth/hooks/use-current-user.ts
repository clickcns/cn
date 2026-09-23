import { canUseClient } from "@repo/shared-types";
import { useAuthStore } from "@/lib/api";

/** 로그인한 사용자. 가드 안쪽 화면에서는 null이 아니다. */
export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}

export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.user?.role === "ADMIN");
}

/** 토큰과 사용자가 모두 있고, 관리 웹을 쓸 수 있는 역할인지. */
export function useIsSignedIn(): boolean {
  return useAuthStore(
    (s) =>
      s.accessToken !== null &&
      s.user !== null &&
      canUseClient(s.user.role, "ADMIN_WEB"),
  );
}
