import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/components/layout/app-layout";
import { RouteError } from "@/components/layout/route-error";
import { LoadingState } from "@/components/ui/data-state";
import { AdminGuard } from "@/features/auth/components/admin-guard";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { GuestGuard } from "@/features/auth/components/guest-guard";
import { HOME_ROUTE, ROUTES } from "@/lib/routes";

/** 화면 단위로 코드를 나눠 첫 로딩을 줄인다. 각 페이지 모듈은 default export를 쓴다. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    // 첫 화면의 페이지 코드를 받는 동안 보여 준다.
    hydrateFallbackElement: <LoadingState className="min-h-dvh" />,
    children: [
      {
        element: <GuestGuard />,
        children: [
          { path: ROUTES.login, lazy: page(() => import("@/pages/login")) },
        ],
      },
      {
        element: <AuthGuard />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: "/", element: <Navigate to={HOME_ROUTE} replace /> },
              {
                path: ROUTES.visits,
                lazy: page(() => import("@/pages/visits")),
              },
              {
                path: `${ROUTES.visits}/:id`,
                lazy: page(() => import("@/pages/visit-detail")),
              },
              {
                path: ROUTES.recipients,
                lazy: page(() => import("@/pages/recipients")),
              },
              {
                path: ROUTES.users,
                lazy: page(() => import("@/pages/users")),
              },
              {
                element: <AdminGuard />,
                children: [
                  {
                    path: ROUTES.organizations,
                    lazy: page(() => import("@/pages/organizations")),
                  },
                ],
              },
              {
                path: "*",
                lazy: page(() => import("@/pages/not-found")),
              },
            ],
          },
        ],
      },
    ],
  },
]);
