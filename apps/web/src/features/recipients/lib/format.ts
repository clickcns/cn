import {
  CARE_GRADE_LABELS,
  fullAge,
  GENDER_LABELS,
  type CareGrade,
  type Gender,
} from "@repo/shared-types";

/** "여 · 만 82세". 나이를 알 수 없으면 생략하고, 정보가 없으면 빈 문자열. */
export function formatRecipientMeta(recipient: {
  gender: Gender | null;
  birthDate: string | null;
}): string {
  const parts: string[] = [];
  if (recipient.gender) parts.push(GENDER_LABELS[recipient.gender]);
  const age = recipient.birthDate ? fullAge(recipient.birthDate) : null;
  if (age !== null) parts.push(`만 ${age}세`);
  return parts.join(" · ");
}

export function formatCareGrade(grade: CareGrade | null): string | null {
  return grade ? CARE_GRADE_LABELS[grade] : null;
}
