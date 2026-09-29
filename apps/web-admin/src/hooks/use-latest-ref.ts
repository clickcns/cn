import { useLayoutEffect, useRef } from "react";

/**
 * 늘 마지막으로 그린 값을 가리키는 ref. 자식에게는 늘 같은 함수를 넘기면서(React Compiler가
 * 자식을 다시 그리지 않게) 그 안에서는 최신 값·함수를 쓸 때 쓴다. 그리는 중에는 읽지 않는다.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
