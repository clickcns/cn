import { Navigate, Outlet, useLocation } from "react-router";
import { useIsSignedIn } from "@/features/auth/hooks/use-current-user";
import { ROUTES } from "@/lib/routes";

/** 로그인하지 않았으면 로그인 화면으로 보내고, 돌아올 주소를 state.from에 남긴다. */
export function AuthGuard() {
  const isSignedIn = useIsSignedIn();
  const location = useLocation();

  if (!isSignedIn) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
