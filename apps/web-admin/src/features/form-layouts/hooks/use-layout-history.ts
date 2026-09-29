import {
  createHistory,
  historyApply,
  historyBegin,
  historyCancel,
  historyCommit,
  historyRedo,
  historyUndo,
} from "@repo/shared-types";
import { useState } from "react";

/**
 * 되돌리기(Ctrl+Z)·다시 하기(Ctrl+Y)가 되는 값. 규칙은 shared-types 의 기록 함수(form-layout-edit.ts)이고,
 * 여기서는 상태로 들고 있기만 한다. 돌려주는 함수들은 setState 만 쓰므로 늘 같은 함수다.
 */
export function useLayoutHistory<T>(initial: T) {
  const [history, setHistory] = useState(() => createHistory(initial));

  /** 새 값을 넣는다. mergeKey 가 같은 변경이 이어지면 한 걸음으로 합친다. */
  const update = (change: (current: T) => T, mergeKey?: string) => {
    const now = Date.now();
    setHistory((current) =>
      historyApply(current, change(current.present), { mergeKey, now }),
    );
  };

  return {
    present: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    update,
    /** 끌기처럼 이어지는 조작의 시작·끝(한 걸음)·취소 */
    begin: () => setHistory(historyBegin),
    commit: () => setHistory(historyCommit),
    cancel: () => setHistory(historyCancel),
    undo: () => setHistory(historyUndo),
    redo: () => setHistory(historyRedo),
  };
}
