import type { AuthResponse, AuthUser } from "@repo/shared-types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /**
   * 토큰과 사용자를 한 번에 갱신한다. 나눠서 set하면 "로그인됐지만 user는 이전 값"인
   * 중간 상태가 렌더링되어 역할별 분기가 잘못 그려진다.
   */
  setSession: (session: AuthResponse) => void;
  logout: () => void;
}

/** 앱마다 다른 storageKey를 써서 간호사 웹과 관리 웹의 세션을 분리한다. */
export function createAuthStore(storageKey: string) {
  const store = create<AuthState>()(
    persist(
      (set) => ({
        accessToken: null,
        refreshToken: null,
        user: null,
        setSession: ({ accessToken, refreshToken, user }) =>
          set({ accessToken, refreshToken, user }),
        logout: () =>
          set({ accessToken: null, refreshToken: null, user: null }),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => localStorage),
        partialize: ({ accessToken, refreshToken, user }) => ({
          accessToken,
          refreshToken,
          user,
        }),
      },
    ),
  );

  // 다른 탭에서 로그인·로그아웃하거나 토큰을 갱신하면 이 탭도 따라간다.
  // (따라가지 않으면 이 탭이 이미 교체된 옛 토큰으로 갱신해 서버가 세션을 끊는다.)
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === storageKey) void store.persist.rehydrate();
    });
  }

  return store;
}

export type AuthStore = ReturnType<typeof createAuthStore>;
