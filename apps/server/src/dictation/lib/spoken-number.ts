/*
 * 말로 읽은 숫자 해석. 음성인식은 숫자를 "130"처럼 쓰기도, "백삼십"처럼 한글로 쓰기도 한다.
 * 초안 검사기가 LLM이 뽑은 값과 근거 문장의 표기(quote)를 대조할 때 쓴다.
 */

const HANGUL_DIGITS: Record<string, number> = {
  영: 0,
  공: 0,
  일: 1,
  이: 2,
  삼: 3,
  사: 4,
  오: 5,
  육: 6,
  륙: 6,
  칠: 7,
  팔: 8,
  구: 9,
};
const HANGUL_UNITS: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };
/** 고유어 수(횟수·개수를 셀 때) */
const NATIVE_COUNTS: Record<string, number> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  열: 10,
};

const ARABIC_NUMBER = /^\d+(?:\.\d+)?/;
const HANGUL_NUMBER_CHARS = /^[영공일이삼사오육륙칠팔구십백천점.]+/;

/** "백삼십" → 130, "삼십육" → 36. 자릿수 순서가 맞지 않으면 null. */
function parseHangulInteger(text: string): number | null {
  if (text === "") return null;
  let total = 0;
  let digit: number | null = null;
  let lastUnit = Infinity;
  for (const char of text) {
    if (char in HANGUL_DIGITS) {
      // "일이"처럼 숫자가 연달아 오면 자릿수 읽기가 아니다.
      if (digit !== null) return null;
      digit = HANGUL_DIGITS[char];
    } else if (char in HANGUL_UNITS) {
      const unit = HANGUL_UNITS[char];
      if (unit >= lastUnit) return null;
      total += (digit ?? 1) * unit;
      digit = null;
      lastUnit = unit;
    } else {
      return null;
    }
  }
  return total + (digit ?? 0);
}

/** 소수부는 한 자리씩 읽는다: "팔" → "8", "오" → "5", "25" → "25". */
function parseFractionDigits(text: string): string | null {
  if (text === "") return null;
  let digits = "";
  for (const char of text) {
    if (/\d/.test(char)) digits += char;
    else if (char in HANGUL_DIGITS) digits += String(HANGUL_DIGITS[char]);
    else return null;
  }
  return digits;
}

/**
 * 숫자 표기 → 숫자. 앞부분의 숫자만 읽고 뒤의 단위·조사는 무시한다.
 * "130" → 130, "36.8도" → 36.8, "36 .8" → 36.8, "백삼십에" → 130, "삼십육 점 팔" → 36.8.
 * 숫자로 읽을 수 없으면 null.
 */
export function parseSpokenNumber(raw: string): number | null {
  const text = raw.replace(/[\s,]/g, "");

  const arabic = ARABIC_NUMBER.exec(text);
  if (arabic) {
    // "36점8"처럼 아라비아 숫자와 "점"을 섞어 쓴 경우
    const rest = text.slice(arabic[0].length);
    if (!arabic[0].includes(".") && rest.startsWith("점")) {
      const fraction = /^\d+/.exec(rest.slice(1));
      if (fraction) return Number(`${arabic[0]}.${fraction[0]}`);
    }
    return Number(arabic[0]);
  }

  const hangul = HANGUL_NUMBER_CHARS.exec(text)?.[0];
  if (!hangul) return null;
  const [integerPart = "", fractionPart, ...rest] = hangul.split(/[점.]/);
  if (rest.length > 0) return null;
  const integer = parseHangulInteger(integerPart);
  if (integer === null) return null;
  if (fractionPart === undefined || fractionPart === "") return integer;
  const fraction = parseFractionDigits(fractionPart);
  return fraction === null ? null : Number(`${integer}.${fraction}`);
}

/**
 * 문장에 나오는 숫자 전부(아라비아 숫자 + 한글로 읽은 숫자 후보).
 * 메모·특이사항의 숫자가 근거에 있는지 느슨하게 확인할 때 쓴다.
 * "이"(조사)처럼 숫자가 아닌 글자도 후보에 들어가지만, 허용 목록이라 검사가 조금 느슨해질 뿐이다.
 */
export function numbersInText(text: string): number[] {
  const numbers: number[] = [];
  const compact = text.replace(/(\d)\s+\.(\d)/g, "$1.$2");
  for (const match of compact.matchAll(/\d+(?:\.\d+)?/g)) {
    numbers.push(Number(match[0]));
  }
  for (const match of compact.matchAll(
    /[영공일이삼사오육륙칠팔구십백천]+(?:\s*점\s*[영공일이삼사오육륙칠팔구]+)?/g,
  )) {
    const value = parseSpokenNumber(match[0]);
    if (value !== null) numbers.push(value);
  }
  // 횟수·개수는 고유어로 읽는다: "두 번", "세 알"
  for (const match of compact.matchAll(
    /(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*(번|회|개|알|명|장|봉|잔|시간)/g,
  )) {
    numbers.push(NATIVE_COUNTS[match[1]]);
  }
  return numbers;
}
