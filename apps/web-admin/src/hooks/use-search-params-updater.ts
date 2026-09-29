import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { useLatestRef } from "@/hooks/use-latest-ref";

/**
 * 쿼리스트링 일부를 바꾸는 함수(값이 비면 그 키를 지우고, 방문 기록은 남기지 않는다).
 * react-router의 setSearchParams는 주소가 바뀔 때마다 새 함수라, 늘 같은 함수로 감싼다.
 */
export function useSearchParamsUpdater() {
  const [, setSearchParams] = useSearchParams();
  const setSearchParamsRef = useLatestRef(setSearchParams);

  return useCallback(
    (changes: Record<string, string | undefined>) => {
      setSearchParamsRef.current(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParamsRef],
  );
}
