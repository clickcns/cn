import { Navigate, Outlet, useLocation } from "react-router";
import { useIsSignedIn } from "@/features/auth/hooks/use-current-user";
import { HOME_ROUTE, ROUTES } from "@/lib/routes";

function redirectTarget(state: unknown): string {
  if (typeof state === "object" && state !== null && "from" in state) {
    const { from } = state as { from: unknown };
    // 외부 주소나 로그인 화면으로 되돌아가지 않게 한다.
    if (
      typeof from === "string" &&
      from.startsWith("/") &&
      !from.startsWith("//") &&
      !from.startsWith(ROUTES.login)
    ) {
      return from;
    }
  }
  return HOME_ROUTE;
}

/** 로그인한 상태로 로그인 화면에 오면 원래 가려던 화면(없으면 방문 기록)으로 보낸다. */
export function GuestGuard() {
  const isSignedIn = useIsSignedIn();
  const location = useLocation();

  if (isSignedIn) {
    return <Navigate to={redirectTarget(location.state)} replace />;
  }

  return <Outlet />;
}
