import { z } from "zod";

/**
 * 선택 입력. 폼의 빈 문자열("", 공백만)은 null("값 없음")로 받는다.
 * undefined는 "변경 없음"으로 그대로 둔다(PATCH).
 * 서버 DTO와 웹 폼이 같은 스키마를 쓰므로 빈 입력 정리는 여기 한 곳에서만 한다.
 */
export function blankToNull<T extends z.ZodType>(schema: T) {
  return z
    .union([z.literal(""), schema])
    .nullish()
    .transform((value) => (value === "" ? null : value));
}

/** 선택 텍스트 입력: 앞뒤 공백 제거, 최대 길이, 빈 값은 null. */
export function optionalText(max: number, label: string) {
  return blankToNull(
    z.string().trim().max(max, `${label}은(는) ${max}자 이하로 입력해 주세요`),
  );
}
