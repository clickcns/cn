import type { ApiErrorBody, AuthResponse } from "@repo/shared-types";
import ky from "ky";
import type { AuthStore } from "./auth-store.js";
import { defaultMessageForStatus, getErrorStatus } from "./errors.js";

export interface HttpClientOptions {
  /** 예: "/api" (vite 프록시) 또는 "https://carenote.example.com/api" */
  baseUrl: string;
  authStore: AuthStore;
}

/** 이 경로의 401은 토큰 갱신으로 풀 수 없다. */
const NO_REFRESH_PATHS = ["/auth/login", "/auth/refresh"];
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * 오래 걸리는 요청의 시간 제한. ky timeout과, 401 뒤 토큰을 갱신하고 다시 보내는 요청에 함께 쓴다.
 * 예: http.post(url, { body, ...withTimeout(180_000) })
 */
export function withTimeout(timeoutMs: number) {
  return { timeout: timeoutMs, context: { timeoutMs } };
}

export function createHttpClient({ baseUrl, authStore }: HttpClientOptions) {
  let refreshPromise: Promise<boolean> | null = null;

  async function performRefresh(): Promise<boolean> {
    // 다른 탭(설치한 앱 + 브라우저 탭 등)이 이미 갱신했을 수 있다.
    // 저장소를 다시 읽어, 새 토큰이 있으면 갱신하지 않고 그대로 쓴다.
    // 옛 토큰으로 갱신하면 서버가 탈취로 보고 세션을 끊는다.
    const previousAccessToken = authStore.getState().accessToken;
    await authStore.persist.rehydrate();
    const state = authStore.getState();
    if (state.accessToken && state.accessToken !== previousAccessToken) {
      return true;
    }

    if (!state.refreshToken) {
      state.logout();
      return false;
    }

    try {
      const session = await ky
        .post(`${baseUrl}/auth/refresh`, {
          json: { refreshToken: state.refreshToken },
          retry: 0,
          timeout: REQUEST_TIMEOUT_MS,
        })
        .json<AuthResponse>();
      authStore.getState().setSession(session);
      return true;
    } catch (error) {
      // 서버가 실제로 거절한 경우(401·403)만 로그아웃한다.
      // 네트워크 끊김·시간 초과·5xx·429는 잠시 뒤 다시 될 수 있으므로 세션을 지우지 않는다
      // (지우면 작성 중이던 기록 화면이 로그인 화면으로 바뀌면서 입력이 사라진다).
      const status = getErrorStatus(error);
      if (status === 401 || status === 403) {
        authStore.getState().logout();
      }
      return false;
    }
  }

  /**
   * 서버가 refresh token을 매번 교체하므로, 동시에 두 번 갱신하면 뒤의 요청이
   * 거절돼 로그아웃된다. 모든 호출자는 진행 중인 갱신 하나를 공유해야 한다.
   */
  function refreshSession(): Promise<boolean> {
    refreshPromise ??= performRefresh().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  const http = ky.create({
    prefixUrl: baseUrl,
    retry: 0,
    timeout: REQUEST_TIMEOUT_MS,
    hooks: {
      beforeRequest: [
        (request) => {
          const { accessToken } = authStore.getState();
          if (accessToken) {
            request.headers.set("Authorization", `Bearer ${accessToken}`);
          }
        },
      ],
      afterResponse: [
        async (request, options, response) => {
          if (response.status !== 401) return response;
          if (NO_REFRESH_PATHS.some((path) => request.url.includes(path))) {
            return response;
          }

          const refreshed = await refreshSession();
          const { accessToken } = authStore.getState();
          if (!refreshed || !accessToken) return response;

          // ky(retry)를 쓰면 ky 기본 retry·timeout 정책이 끼어든다. fetch로 한 번만 다시
          // 보내되, ky 타이머는 이미 끝났으므로 시간 제한을 직접 건다(안 걸면 영원히 대기).
          // withTimeout()으로 요청마다 정한 시간 제한(예: 음성 구술 3분)이 있으면 그대로 쓴다.
          const retry = request.clone();
          retry.headers.set("Authorization", `Bearer ${accessToken}`);
          const { timeoutMs } = options.context;
          return fetch(retry, {
            signal: AbortSignal.timeout(
              typeof timeoutMs === "number" ? timeoutMs : REQUEST_TIMEOUT_MS,
            ),
          });
        },
      ],
      beforeError: [
        async (error) => {
          // error.message를 항상 한국어로 만든다: 서버 메시지, 없으면 상태 코드별 기본 문구.
          const body = (await error.response
            .clone()
            .json()
            .catch(() => null)) as Partial<ApiErrorBody> | null;
          error.message =
            body?.message ?? defaultMessageForStatus(error.response.status);
          return error;
        },
      ],
    },
  });

  return { http, refreshSession };
}
