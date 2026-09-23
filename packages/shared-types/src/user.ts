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

const PasswordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다")
  .max(72, "비밀번호는 72자 이하여야 합니다");

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
