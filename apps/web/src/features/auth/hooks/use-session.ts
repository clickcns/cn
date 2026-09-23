import { canUseClient } from "@repo/shared-types";
import { useAuthStore } from "@/lib/api";

/**
 * 현장 웹에 로그인된 상태인지. 다른 역할의 세션이 저장소에 남아 있어도
 * 로그인되지 않은 것으로 본다(AuthGuard·GuestGuard가 같은 기준을 써야 루프가 없다).
 */
export function useIsSignedIn(): boolean {
  return useAuthStore(
    ({ accessToken, user }) =>
      Boolean(accessToken) &&
      user !== null &&
      canUseClient(user.role, "FIELD_WEB"),
  );
}

/** 로그인한 사용자. 로그아웃 직후 한 번의 렌더에서는 null일 수 있다. */
export function useCurrentUser() {
  return useAuthStore((state) => state.user);
}
