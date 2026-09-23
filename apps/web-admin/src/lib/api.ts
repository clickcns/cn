import {
  createAuthStore,
  createCarenoteApi,
  createHttpClient,
} from "@repo/api-client";
import { queryClient } from "@/lib/query-client";

/** 관리 웹 세션. 현장 웹과 storageKey를 달리해 세션을 분리한다. */
export const useAuthStore = createAuthStore("carenote-admin-auth");

const { http } = createHttpClient({
  // 값을 비워 두면(VITE_API_BASE_URL=) vite 프록시를 쓰도록 ||를 쓴다. ??는 ""를 그대로 쓴다.
  baseUrl: import.meta.env.VITE_API_BASE_URL || "/api",
  authStore: useAuthStore,
});

export const api = createCarenoteApi(http);

// 세션이 끊기면(로그아웃·만료) 이전 사용자의 캐시가 다음 사용자에게 보이지 않도록 비운다.
useAuthStore.subscribe((state, previous) => {
  if (previous.accessToken && !state.accessToken) queryClient.clear();
});
