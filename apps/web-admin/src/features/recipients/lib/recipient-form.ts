import type { Recipient, UpdateRecipientInput } from "@repo/shared-types";

/** 등록·수정 폼이 함께 쓰는 입력 칸. 빈 입력("")은 스키마가 null로 바꾼다. */
export type RecipientFieldValues = Omit<UpdateRecipientInput, "isActive">;

export const EMPTY_RECIPIENT_FIELDS = {
  name: "",
  birthDate: null,
  gender: null,
  careGrade: null,
  ltcCertNumber: null,
  phone: null,
  address: null,
  guardianName: null,
  guardianPhone: null,
  notes: null,
} satisfies RecipientFieldValues;

/** 수정 폼 기본값: 수급자에서 폼 칸만 고른다. */
export function toEditRecipientFormValues(
  recipient: Recipient,
): UpdateRecipientInput {
  const {
    name,
    birthDate,
    gender,
    careGrade,
    ltcCertNumber,
    phone,
    address,
    guardianName,
    guardianPhone,
    notes,
    isActive,
  } = recipient;
  return {
    name,
    birthDate,
    gender,
    careGrade,
    ltcCertNumber,
    phone,
    address,
    guardianName,
    guardianPhone,
    notes,
    isActive,
  };
}
