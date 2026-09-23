import { useSyncExternalStore } from "react";
import { Outlet, ScrollRestoration } from "react-router";
import { useAuthStore } from "@/lib/api";

const subscribe = (onStoreChange: () => void) =>
  useAuthStore.persist.onFinishHydration(onStoreChange);

const getSnapshot = () => useAuthStore.persist.hasHydrated();

/** 로그인 정보(localStorage) 복원이 끝난 뒤에 화면을 그린다. */
export function RootLayout() {
  const hasHydrated = useSyncExternalStore(subscribe, getSnapshot);

  if (!hasHydrated) return null;

  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}
