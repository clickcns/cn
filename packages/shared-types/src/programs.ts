import type { FormId } from "./forms/index.js";
import type { Profession } from "./roles.js";

/**
 * 사업(서비스) 구분. 사업과 담당자 직종이 방문 때 쓸 서식을 정한다.
 * 기관은 여러 사업을 할 수 있다(예: 재택의료센터이면서 일차의료 방문진료 시범기관).
 */
export const PROGRAMS = [
  "PRIMARY_CARE",
  "HOME_CARE_CENTER",
  "LTC_NURSING",
] as const;
export type Program = (typeof PROGRAMS)[number];

export const PROGRAM_LABELS: Record<Program, string> = {
  PRIMARY_CARE: "일차의료 방문진료",
  HOME_CARE_CENTER: "재택의료센터",
  LTC_NURSING: "장기요양 방문간호",
};

/**
 * 사업·직종별 서식. 없는 조합은 그 직종이 이 사업의 방문을 맡을 수 없다는 뜻이다.
 * 재택의료센터 의사 방문은 방문진료료(별지 제4호, 심평원)와 재택의료 기록(별지 제6호, 공단)을 함께 쓴다.
 */
export const PROGRAM_FORMS: Record<
  Program,
  Partial<Record<Profession, readonly FormId[]>>
> = {
  PRIMARY_CARE: { DOCTOR: ["PRIMARY_CARE_CHECK"] },
  HOME_CARE_CENTER: {
    DOCTOR: ["PRIMARY_CARE_CHECK", "HOME_CARE_DOCTOR"],
    NURSE: ["HOME_CARE_NURSE"],
    SOCIAL_WORKER: ["HOME_CARE_SOCIAL"],
  },
  LTC_NURSING: { NURSE: ["LTC_NURSING"] },
};

export function formIdsFor(
  program: Program,
  profession: Profession | null,
): readonly FormId[] {
  return profession ? (PROGRAM_FORMS[program][profession] ?? []) : [];
}

/** 이 직종이 이 사업의 방문을 맡을 수 있는지(쓸 서식이 있는지). */
export function canHandleProgram(
  program: Program,
  profession: Profession | null,
): boolean {
  return formIdsFor(program, profession).length > 0;
}
