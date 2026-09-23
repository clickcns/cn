import { useEffect, useState } from "react";

/** 입력이 멈춘 뒤 delay(ms)가 지나야 바뀌는 값. 검색어처럼 서버 요청을 줄일 때 쓴다. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
