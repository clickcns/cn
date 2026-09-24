import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowShortPasswordsForDev,
  UpdateUserSchema,
} from "@repo/shared-types";

// 개발용 규칙은 켜면 되돌릴 수 없으므로 이 파일에서만 켠다(테스트 파일마다 프로세스가 따로다).
describe("비밀번호 규칙", () => {
  it("운영 규칙은 8자 이상이고, 개발용 규칙을 켜면 4자부터 받는다", () => {
    const check = (password: string) =>
      UpdateUserSchema.safeParse({ password }).success;
    assert.equal(check("1234"), false);
    assert.equal(check("12345678"), true);
    allowShortPasswordsForDev();
    assert.equal(check("1234"), true);
    assert.equal(check("123"), false);
  });
});
