import { useEffect } from "react";
import { useBlocker } from "react-router";

/**
 * 저장하지 않은 변경이 있을 때
 * - 새로고침·탭 닫기: 브라우저 기본 경고(beforeunload)
 * - 앱 안 이동(주소·쿼리스트링이 바뀌는 모든 이동): 돌려받은 blocker로 확인 창을 띄운다.
 * (현장 웹 features/visits/hooks/use-unsaved-changes-guard.ts 와 같은 규칙, 관리 웹은 탭 전환이
 * 쿼리스트링이라 그것도 막는다.)
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 일부 브라우저는 returnValue가 있어야 경고를 띄운다.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
}
