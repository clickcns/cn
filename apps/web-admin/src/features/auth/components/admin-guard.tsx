import { Navigate, Outlet } from "react-router";
import { useIsAdmin } from "@/features/auth/hooks/use-current-user";
import { HOME_ROUTE } from "@/lib/routes";

/** 운영자(ADMIN) 전용 화면. 그 밖의 역할은 방문 기록으로 보낸다. */
export function AdminGuard() {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return <Navigate to={HOME_ROUTE} replace />;
  }

  return <Outlet />;
}
