export const ROUTES = {
  login: "/login",
  dashboard: "/dashboard",
  visits: "/visits",
  visitDetail: (id: string) => `/visits/${id}`,
  recipients: "/recipients",
  users: "/users",
  organizations: "/organizations",
} as const;

/** 로그인 뒤 기본으로 가는 화면. */
export const HOME_ROUTE = ROUTES.dashboard;
