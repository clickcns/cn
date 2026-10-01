import { useState } from "react";
import type { FormId } from "@repo/shared-types";
import type { PastFill, PastFills } from "@/features/forms/lib/past-fill";

/**
 * 기록 화면에서 지난 기록으로 채운 칸(이월 칸 채우기·서식/구분 불러오기·칸마다 지난 값). 화면에 머무는 동안만
 * 기억하고, 칸의 지금 값이 채운 값과 같을 때만 표시한다(form-fields 가 비교한다).
 */
export function usePastFills() {
  const [fills, setFills] = useState<Partial<Record<FormId, PastFills>>>({});

  /** 채운 칸들을 기억한다(같은 칸은 새 값으로). */
  const mark = (formId: FormId, entries: Record<string, PastFill>) =>
    setFills((current) => ({
      ...current,
      [formId]: { ...current[formId], ...entries },
    }));

  return { fills, mark };
}
