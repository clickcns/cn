import {
  CARE_GRADE_LABELS,
  fullAge,
  GENDER_LABELS,
  type CareGrade,
  type Gender,
} from "@repo/shared-types";

/** "여 · 만 82세 · 차트 1001". 모르는 정보는 생략하고, 정보가 없으면 빈 문자열. */
export function formatRecipientMeta(recipient: {
  gender: Gender | null;
  birthDate: string | null;
  chartNumber: string | null;
}): string {
  const parts: string[] = [];
  if (recipient.gender) parts.push(GENDER_LABELS[recipient.gender]);
  const age = recipient.birthDate ? fullAge(recipient.birthDate) : null;
  if (age !== null) parts.push(`만 ${age}세`);
  if (recipient.chartNumber) parts.push(`차트 ${recipient.chartNumber}`);
  return parts.join(" · ");
}

export function formatCareGrade(grade: CareGrade | null): string | null {
  return grade ? CARE_GRADE_LABELS[grade] : null;
}
