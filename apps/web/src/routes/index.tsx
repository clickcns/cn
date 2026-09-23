import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/components/layout/app-layout";
import { RootLayout } from "@/components/layout/root-layout";
import { RouteError } from "@/components/layout/route-error";
import { PageLoading } from "@/components/ui/page-state";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { GuestGuard } from "@/features/auth/components/guest-guard";
import { ROUTES } from "@/lib/routes";

/** 화면 단위로 코드를 나눠 첫 로딩을 줄인다. 각 페이지 모듈은 default export를 쓴다. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    // 첫 화면의 페이지 코드를 받는 동안 보여 준다.
    hydrateFallbackElement: <PageLoading className="min-h-dvh" />,
    errorElement: <RouteError />,
    children: [
      {
        element: <GuestGuard />,
        children: [
          { path: ROUTES.LOGIN, lazy: page(() => import("@/pages/login")) },
        ],
      },
      {
        element: <AuthGuard />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: ROUTES.VISITS,
                lazy: page(() => import("@/pages/visits")),
              },
              {
                path: ROUTES.NEW_VISIT,
                lazy: page(() => import("@/pages/visit-new")),
              },
              {
                path: ROUTES.VISIT_DETAIL,
                lazy: page(() => import("@/pages/visit-detail")),
              },
              {
                path: ROUTES.RECIPIENTS,
                lazy: page(() => import("@/pages/recipients")),
              },
              {
                path: ROUTES.RECIPIENT_DETAIL,
                lazy: page(() => import("@/pages/recipient-detail")),
              },
              { path: ROUTES.ME, lazy: page(() => import("@/pages/me")) },
            ],
          },
        ],
      },
      { path: "*", lazy: page(() => import("@/pages/not-found")) },
    ],
  },
]);
