import { z } from "zod";
import { PROGRAMS, type Program } from "./programs.js";
import { optionalText } from "./schema.js";

/** 기관 종별. 재택의료 수입의 방문진료료 단가를 고른다(fee-schedule.ts의 visitFeeFor). */
export const INSTITUTION_TYPES = [
  "CLINIC",
  "HOSPITAL",
  "PUBLIC_HEALTH",
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  CLINIC: "의원",
  HOSPITAL: "병원급 이상",
  PUBLIC_HEALTH: "보건소·보건지소·보건의료원",
};

export const CreateOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "기관 이름을 입력해 주세요")
    .max(100, "기관 이름은 100자 이하로 입력해 주세요"),
  /** 요양기관기호·장기요양기관 기호 등 기관 식별 코드. 서식 머리에 적는다. */
  code: optionalText(20, "기관 코드"),
  /** 기관이 하는 사업. 방문을 만들 때 이 중에서 고른다. */
  programs: z
    .array(z.enum(PROGRAMS), "사업을 하나 이상 선택해 주세요")
    .min(1, "사업을 하나 이상 선택해 주세요")
    .refine(
      (programs) => new Set(programs).size === programs.length,
      "같은 사업이 중복되었습니다",
    ),
  /** 기관 종별. 보내지 않으면 DB 기본값(의원) */
  institutionType: z
    .enum(INSTITUTION_TYPES, "기관 종별을 골라 주세요")
    .optional(),
});
export type CreateOrganizationInput = z.input<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();
export type UpdateOrganizationInput = z.input<typeof UpdateOrganizationSchema>;

export interface Organization {
  id: string;
  name: string;
  code: string | null;
  programs: Program[];
  institutionType: InstitutionType;
  userCount: number;
  recipientCount: number;
  createdAt: string;
}
