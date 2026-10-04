import { useSyncExternalStore } from "react";

/*
 * 지금 시각(1분 단위). 그리는 중에 Date.now()를 부르지 않도록 바깥 저장소로 둔다: 1분마다, 화면에 돌아올
 * 때마다 바뀐다. 구독하는 화면이 없으면 시계도 멈춘다.
 */
let now = Date.now();
const listeners = new Set<() => void>();
let timer: number | undefined;

function tick() {
  now = Date.now();
  for (const listener of listeners) listener();
}

function onVisibility() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

/** 지금 시각(ms). 1분마다·화면에 돌아올 때 다시 그린다. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}
