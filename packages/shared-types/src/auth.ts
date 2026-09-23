import { z } from "zod";
import type { Program } from "./programs.js";
import { LOGIN_CLIENTS, type Profession, type Role } from "./roles.js";

/** 아이디: 영문 소문자로 시작, 영문 소문자·숫자·.-_ 3~30자. */
export const USERNAME_REGEX = /^[a-z][a-z0-9._-]{2,29}$/;

export const LoginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
  /** 로그인하는 앱. 주면 그 앱을 쓸 수 없는 역할은 세션을 만들기 전에 403으로 거절한다. */
  client: z.enum(LOGIN_CLIENTS).optional(),
});
export type LoginInput = z.input<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  profession: Profession | null;
  organizationId: string | null;
  organizationName: string | null;
  /** 소속 기관이 하는 사업(방문을 만들 때 고른다). 운영자는 빈 배열. */
  programs: Program[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
