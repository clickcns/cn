import { z } from "zod";
import { USERNAME_REGEX } from "./auth.js";
import {
  PROFESSIONS,
  ROLES,
  requiresProfession,
  type Profession,
  type Role,
} from "./roles.js";
import { blankToNull, optionalText } from "./schema.js";

const ProfessionSchema = blankToNull(
  z.enum(PROFESSIONS, "직종을 선택해 주세요"),
);
const LicenseNumberSchema = optionalText(30, "면허·자격번호");

/** 비밀번호 최소 길이: 운영 8자, 개발 4자(시드 비밀번호 1234처럼). */
const PASSWORD_MIN_LENGTH = 8;
const DEV_PASSWORD_MIN_LENGTH = 4;
let passwordMinLength = PASSWORD_MIN_LENGTH;

/**
 * 개발 환경에서 비밀번호를 4자부터 받는다. `pnpm dev`로 띄운 서버(ALLOW_SHORT_PASSWORDS)와
 * 관리 웹 개발 서버가 시작할 때 한 번 부른다(부르지 않으면 운영 규칙 8자).
 * 스키마가 검사할 때 읽으므로 스키마를 다시 만들 필요가 없다.
 */
export function allowShortPasswordsForDev(): void {
  passwordMinLength = DEV_PASSWORD_MIN_LENGTH;
}

/** 지금 적용 중인 비밀번호 최소 길이(입력 칸 안내에 쓴다). */
export function getPasswordMinLength(): number {
  return passwordMinLength;
}

const PasswordSchema = z
  .string()
  .max(72, "비밀번호는 72자 이하여야 합니다")
  .refine((password) => password.length >= passwordMinLength, {
    error: () => `비밀번호는 ${passwordMinLength}자 이상이어야 합니다`,
  });

export const CreateUserSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        USERNAME_REGEX,
        "아이디는 영문 소문자로 시작하는 3~30자(영문 소문자·숫자·.-_)여야 합니다",
      ),
    name: z
      .string()
      .trim()
      .min(1, "이름을 입력해 주세요")
      .max(50, "이름은 50자 이하로 입력해 주세요"),
    password: PasswordSchema,
    role: z.enum(ROLES, "역할을 선택해 주세요"),
    /** 방문 때 쓰는 서식을 정한다. 현장 직원은 필수, 운영자는 없음. */
    profession: ProfessionSchema,
    licenseNumber: LicenseNumberSchema,
    /** 운영자(ADMIN)만 지정한다. 기관 관리자가 만들면 자기 기관으로 고정된다. */
    organizationId: blankToNull(z.uuid("기관을 선택해 주세요")),
  })
  .refine((user) => !requiresProfession(user.role) || user.profession, {
    message: "현장 직원은 직종을 선택해 주세요",
    path: ["profession"],
  });
export type CreateUserInput = z.input<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요")
    .max(50, "이름은 50자 이하로 입력해 주세요")
    .optional(),
  role: z.enum(ROLES).optional(),
  profession: ProfessionSchema,
  licenseNumber: LicenseNumberSchema,
  isActive: z.boolean().optional(),
  /** 값이 있으면 비밀번호를 재설정한다. */
  password: PasswordSchema.optional(),
  organizationId: blankToNull(z.uuid("기관을 선택해 주세요")),
});
export type UpdateUserInput = z.input<typeof UpdateUserSchema>;

/** 본인 비밀번호 바꾸기 칸. 새 비밀번호 규칙은 계정을 만들 때와 같다. */
const ChangePasswordFields = z.object({
  currentPassword: z.string().min(1, "지금 비밀번호를 입력해 주세요"),
  newPassword: PasswordSchema,
});

/** 새 비밀번호는 지금 비밀번호와 달라야 한다. */
const isNewPassword = (values: {
  currentPassword: string;
  newPassword: string;
}) => values.currentPassword !== values.newPassword;
const SAME_PASSWORD_ISSUE = {
  message: "지금 비밀번호와 다른 비밀번호를 입력해 주세요",
  path: ["newPassword"],
};

/** 본인 비밀번호 바꾸기(POST /auth/password). 서버가 지금 비밀번호를 확인한 뒤 바꾼다. */
export const ChangePasswordSchema = ChangePasswordFields.refine(
  isNewPassword,
  SAME_PASSWORD_ISSUE,
);
export type ChangePasswordInput = z.input<typeof ChangePasswordSchema>;

/** 두 웹의 비밀번호 바꾸기 폼: 새 비밀번호를 한 번 더 입력한다(확인 칸은 서버에 보내지 않는다). */
export const ChangePasswordFormSchema = ChangePasswordFields.extend({
  confirmPassword: z.string().min(1, "새 비밀번호를 한 번 더 입력해 주세요"),
})
  .refine(isNewPassword, SAME_PASSWORD_ISSUE)
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "새 비밀번호가 서로 다릅니다",
    path: ["confirmPassword"],
  });

export const UserListQuerySchema = z.object({
  organizationId: z.uuid().optional(),
  role: z.enum(ROLES).optional(),
  profession: z.enum(PROFESSIONS).optional(),
});
export type UserListQuery = z.input<typeof UserListQuerySchema>;

export interface UserSummary {
  id: string;
  username: string;
  name: string;
  role: Role;
  profession: Profession | null;
  licenseNumber: string | null;
  isActive: boolean;
  organizationId: string | null;
  organizationName: string | null;
  createdAt: string;
}
