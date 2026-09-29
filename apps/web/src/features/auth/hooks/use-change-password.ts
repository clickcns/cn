import type { ChangePasswordInput } from "@repo/shared-types";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** 본인 비밀번호 바꾸기. 이 기기의 로그인은 그대로이고, 다른 기기는 로그아웃된다. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api.auth.changePassword(input),
  });
}
