import { z } from "zod";
import {
  PROGRAM_LABELS,
  PROGRAMS,
  requiresCareGrade,
  type Program,
} from "./programs.js";
import { blankToNull, optionalText } from "./schema.js";
import { withParticle } from "./text.js";

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

/**
 * 수급자 등록 사업 규칙. 문제가 없으면 null, 있으면 한국어 문구.
 * - 재택의료센터·장기요양 방문간호는 장기요양등급이 있는 수급자만 등록한다.
 * - 재택의료센터 수급자의 의사 방문은 재택의료센터 방문(별지 제6호, 방문진료료를 청구하면 제4호도)이다.
 *   일차의료 방문진료로 따로 등록하면 제6호 없는 방문을 만들 수 있으므로 함께 두지 않는다.
 * 스키마(등록·수정 폼)와 서버(저장된 값과 합친 뒤)가 함께 쓴다.
 */
export function checkRecipientPrograms(
  programs: readonly Program[],
  careGrade: CareGrade | null,
): string | null {
  const needsGrade = programs.filter(requiresCareGrade);
  if (careGrade === null && needsGrade.length > 0) {
    const names = needsGrade.map((program) => PROGRAM_LABELS[program]);
    return `${withParticle(names.join("·"), "은/는")} 장기요양등급이 있는 수급자만 등록할 수 있습니다`;
  }
  if (
    programs.includes("HOME_CARE_CENTER") &&
    programs.includes("PRIMARY_CARE")
  ) {
    return "재택의료센터 수급자는 일차의료 방문진료를 따로 등록하지 않습니다. 의사 방문 때 재택의료센터 방문에서 별지 제4호를 함께 씁니다";
  }
  return null;
}

/**
 * 수급자가 등록한(동의한) 사업. 방문은 이 중에서 고른다. 등록할 때는 하나 이상이어야 하지만,
 * 수정할 때는 비어 있어도 된다(기관이 사업을 그만둬 등록 사업이 빈 수급자도 고치거나 사용 중지할 수 있게).
 */
const recipientPrograms = z
  .array(z.enum(PROGRAMS), "등록 사업을 선택해 주세요")
  .refine(
    (programs) => new Set(programs).size === programs.length,
    "같은 사업이 중복되었습니다",
  );

const RecipientFieldsSchema = z.object({
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
  programs: recipientPrograms,
  /** 운영자(ADMIN)만 지정한다. 기관 관리자가 만들면 자기 기관으로 고정된다. */
  organizationId: blankToNull(z.uuid("기관을 선택해 주세요")),
});

/** 등록 사업·장기요양등급 교차 규칙 문구를 programs 칸 오류로 단다. */
function addProgramsIssue(
  programs: readonly Program[],
  careGrade: CareGrade | null,
  ctx: z.RefinementCtx,
) {
  const message = checkRecipientPrograms(programs, careGrade);
  if (message) ctx.addIssue({ code: "custom", message, path: ["programs"] });
}

/** 등록할 때는 등록 사업이 하나 이상이어야 하고, 보내지 않은 등급은 "등급 없음"이다. */
export const CreateRecipientSchema = RecipientFieldsSchema.superRefine(
  ({ programs, careGrade }, ctx) => {
    if (programs.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "등록 사업을 하나 이상 선택해 주세요",
        path: ["programs"],
      });
      return;
    }
    addProgramsIssue(programs, careGrade ?? null, ctx);
  },
);
export type CreateRecipientInput = z.input<typeof CreateRecipientSchema>;

/** 수정은 두 칸이 모두 올 때만 여기서 보고, 한쪽만 오면 서버가 저장된 값과 합쳐 확인한다. */
export const UpdateRecipientSchema = RecipientFieldsSchema.omit({
  organizationId: true,
})
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .superRefine(({ programs, careGrade }, ctx) => {
    if (programs !== undefined && careGrade !== undefined) {
      addProgramsIssue(programs, careGrade, ctx);
    }
  });
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
  /** 등록한 사업. 방문은 이 중에서 고른다. */
  programs: Program[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
