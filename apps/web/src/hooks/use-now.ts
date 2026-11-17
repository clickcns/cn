import { formatKstDate } from "@repo/shared-types";
import { useSyncExternalStore } from "react";

/*
 * 지금 시각(1분 단위)과 오늘 날짜. 그리는 중에 Date.now()·formatKstDate()를 부르지 않도록 바깥 저장소로
 * 둔다(React Compiler가 인자 없는 호출을 한 번만 계산할 수 있다): 1분마다, 화면에 돌아올 때마다 바뀐다.
 * 구독하는 화면이 없으면 시계도 멈추고, 그동안 처음 읽을 때 1분 넘게 묵었으면 새로 센다(자정을 넘긴 뒤 처음
 * 그리는 화면이 어제를 읽지 않게).
 */
let now = Date.now();
let today = formatKstDate(new Date(now));
const listeners = new Set<() => void>();
let timer: number | undefined;

function refresh() {
  now = Date.now();
  today = formatKstDate(new Date(now));
}

function tick() {
  refresh();
  for (const listener of listeners) listener();
}

/** 시계가 멈춘 동안(구독 없음) 묵은 값이면 새로 센다. 같은 그리기 안에서는 같은 값을 돌려준다. */
function fresh() {
  if (listeners.size === 0 && Date.now() - now >= 60_000) refresh();
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

/** 오늘(한국 날짜 YYYY-MM-DD). 날짜가 바뀔 때만 다시 그린다. */
export function useToday(): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      fresh();
      return today;
    },
    () => today,
  );
}

/** 지금 시각(ms). 1분마다·화면에 돌아올 때 다시 그린다. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => {
      fresh();
      return now;
    },
    () => now,
  );
}
