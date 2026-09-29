import * as bcrypt from "bcryptjs";

/** 비밀번호 해시(bcrypt). 계정 만들기·재설정(사용자 관리)과 본인 변경(인증)이 함께 쓴다. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
