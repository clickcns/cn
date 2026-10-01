import type { PastFieldValues } from "@repo/shared-types";
import type { FieldState } from "@/features/forms/lib/form-state";

/**
 * 지난 기록에서 채운 칸 값과 그 기록의 방문 날짜(한국 날짜). 칸의 지금 값이 이 값과 같은 동안 "지난 기록"
 * 표시를 단다(사용자가 고치면 사라진다).
 */
export interface PastFill {
  state: FieldState;
  date: string;
}

/** 서식 한 장에서 지난 기록으로 채운 칸(칸 키 → 채운 값). */
export type PastFills = Record<string, PastFill>;

/** 서식 한 장의 입력 화면에 넘기는 지난 기록 정보. */
export interface FormPast {
  /** 칸마다 지난 값(빈 칸 옆에 보여 준다). 끄면 없다 */
  values?: PastFieldValues;
  /** 지난 기록으로 채운 칸(표시를 단다) */
  fills: PastFills;
  /** 칸 옆 "지난 값"을 눌러 채웠을 때 */
  onFill: (entries: PastFills) => void;
}
