import { z } from "zod";
import { blankToNull, optionalText } from "./schema.js";

export const GENDERS = ["MALE", "FEMALE"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "남",
  FEMALE: "여",
};

/** 장기요양등급. COGNITIVE = 인지지원등급. */
export const CARE_GRADES = ["1", "2", "3", "4", "5", "COGNITIVE"] as const;
export type CareGrade = (typeof CARE_GRADES)[number];
export const CARE_GRADE_LABELS: Record<CareGrade, string> = {
  "1": "1등급",
  "2": "2등급",
  "3": "3등급",
  "4": "4등급",
  "5": "5등급",
  COGNITIVE: "인지지원등급",
};

export const CreateRecipientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요")
    .max(50, "이름은 50자 이하로 입력해 주세요"),
  /** YYYY-MM-DD */
  birthDate: blankToNull(z.iso.date("생년월일 형식이 올바르지 않습니다")),
  gender: blankToNull(z.enum(GENDERS)),
  careGrade: blankToNull(z.enum(CARE_GRADES)),
  /** 장기요양인정번호(재택의료 서식 머리에 적는다) */
  ltcCertNumber: optionalText(20, "장기요양인정번호"),
  phone: optionalText(30, "연락처"),
  address: optionalText(200, "주소"),
  guardianName: optionalText(50, "보호자 이름"),
  guardianPhone: optionalText(30, "보호자 연락처"),
  notes: optionalText(1000, "메모"),
  /** 운영자(ADMIN)만 지정한다. 기관 관리자가 만들면 자기 기관으로 고정된다. */
  organizationId: blankToNull(z.uuid("기관을 선택해 주세요")),
});
export type CreateRecipientInput = z.input<typeof CreateRecipientSchema>;

export const UpdateRecipientSchema = CreateRecipientSchema.omit({
  organizationId: true,
})
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateRecipientInput = z.input<typeof UpdateRecipientSchema>;

export const RecipientListQuerySchema = z.object({
  q: z.string().trim().max(50).optional(),
  organizationId: z.uuid().optional(),
  includeInactive: z.enum(["true", "false"]).optional(),
});
export type RecipientListQuery = z.infer<typeof RecipientListQuerySchema>;

export interface Recipient {
  id: string;
  organizationId: string;
  name: string;
  /** YYYY-MM-DD */
  birthDate: string | null;
  gender: Gender | null;
  careGrade: CareGrade | null;
  ltcCertNumber: string | null;
  phone: string | null;
  address: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
