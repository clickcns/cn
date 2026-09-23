import { Navigate, Outlet } from "react-router";
import { useIsSignedIn } from "@/features/auth/hooks/use-session";
import { ROUTES } from "@/lib/routes";

/** 이미 로그인했으면 로그인 화면 대신 방문 목록으로 보낸다. */
export function GuestGuard() {
  const signedIn = useIsSignedIn();

  if (signedIn) return <Navigate to={ROUTES.VISITS} replace />;

  return <Outlet />;
}
