import { Navigate, Outlet } from "react-router";
import { useIsSignedIn } from "@/features/auth/hooks/use-session";
import { ROUTES } from "@/lib/routes";

/** 로그인하지 않았으면 로그인 화면으로 보낸다. */
export function AuthGuard() {
  const signedIn = useIsSignedIn();

  if (!signedIn) return <Navigate to={ROUTES.LOGIN} replace />;

  return <Outlet />;
}
