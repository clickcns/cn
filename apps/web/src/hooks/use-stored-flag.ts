import { useState } from "react";

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  } catch {
    return fallback;
  }
}

/**
 * 브라우저에 기억하는 켜기·끄기(마지막 선택). 처음에는 fallback 이다.
 * 저장소를 못 쓰면(사생활 보호 모드 등) 기억하지 않고 화면 안에서만 바뀐다.
 */
export function useStoredFlag(
  key: string,
  fallback: boolean,
): [value: boolean, toggle: () => void] {
  const [value, setValue] = useState(() => readFlag(key, fallback));
  const toggle = () => {
    try {
      localStorage.setItem(key, String(!value));
    } catch {
      // 기억하지 않는다.
    }
    setValue(!value);
  };
  return [value, toggle];
}
