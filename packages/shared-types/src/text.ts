/**
 * 받침에 맞는 조사를 붙인다: withParticle("욕창 관리", "은/는") → "욕창 관리는".
 * 끝의 괄호 설명은 건너뛰고 그 앞 글자로 고른다: "방문점검 기록지(간호사)" + "이/가" → "방문점검 기록지(간호사)가".
 * 한글로 끝나지 않으면 두 조사를 함께 적는다: "SpO2은(는)".
 */
export function withParticle(
  word: string,
  particle: "은/는" | "이/가" | "을/를",
): string {
  const [afterBatchim, afterVowel] = particle.split("/") as [string, string];
  const base = word.replace(/\s*\(.*\)$/, "");
  const last = base.charCodeAt(base.length - 1);
  if (!(last >= 0xac00 && last <= 0xd7a3)) {
    return `${word}${afterBatchim}(${afterVowel})`;
  }
  return `${word}${(last - 0xac00) % 28 === 0 ? afterVowel : afterBatchim}`;
}
