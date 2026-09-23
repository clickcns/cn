import { useEffect, useState } from "react";

/** 입력이 멈추고 delay(ms)가 지난 뒤의 값을 돌려준다. 검색어 요청을 줄일 때 쓴다. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
