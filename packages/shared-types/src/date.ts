/** 서비스 기준 시간대는 한국 표준시(UTC+9, 서머타임 없음)다. */
export const KST_OFFSET = "+09:00";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 주어진 시각의 한국 날짜를 YYYY-MM-DD로 돌려준다. */
export function formatKstDate(date: Date = new Date()): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 주어진 시각의 한국 시각을 HH:mm으로 돌려준다. */
export function formatKstTime(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(11, 16);
}

/** YYYY-MM-DD(한국 날짜)의 0시를 UTC 기준 Date로 돌려준다. */
export function kstStartOfDay(date: string): Date {
  return new Date(`${date}T00:00:00${KST_OFFSET}`);
}

/** YYYY-MM-DD(한국 날짜)에 일수를 더한 한국 날짜를 돌려준다. */
export function addKstDays(date: string, days: number): string {
  const start = kstStartOfDay(date);
  return formatKstDate(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));
}

/** 한국 날짜와 HH:mm을 합쳐 오프셋이 붙은 ISO 문자열로 돌려준다. */
export function toKstIsoDateTime(date: string, time: string): string {
  return `${date}T${time}:00${KST_OFFSET}`;
}

/** 시각 입력 HH:mm (00:00~23:59). */
export const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD 형식이면서 달력에 실제로 있는 날짜인지(2026-02-30은 거짓). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const ISO_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** YYYY-MM 형식의 달인지. */
export function isIsoMonth(value: unknown): value is string {
  return typeof value === "string" && ISO_MONTH_REGEX.test(value);
}

/** YYYY-MM-DD(한국 날짜)가 속한 달. 예: "2026-09-24" → "2026-09" */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** YYYY-MM에 달 수를 더한다. 예: addMonths("2026-12", 1) → "2027-01" */
export function addMonths(month: string, months: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = year! * 12 + (monthNumber! - 1) + months;
  const nextYear = Math.floor(index / 12);
  return `${String(nextYear).padStart(4, "0")}-${String(index - nextYear * 12 + 1).padStart(2, "0")}`;
}

/** 두 한국 날짜 사이의 일수(to - from). 같은 날이면 0. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      (24 * 60 * 60 * 1000),
  );
}

/**
 * 달력 한 장에 보이는 날짜(YYYY-MM-DD, 오름차순). 일요일에 시작해 토요일에 끝나는
 * 주 단위라 앞뒤 달 날짜가 섞이고, 4~6주(28~42일)다.
 */
export function monthGridDates(month: string): string[] {
  const first = `${month}-01`;
  const last = addKstDays(`${addMonths(month, 1)}-01`, -1);
  const start = addKstDays(first, -weekdayIndex(first));
  const end = addKstDays(last, 6 - weekdayIndex(last));
  const dates: string[] = [];
  for (let date = start; date <= end; date = addKstDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/** YYYY-MM-DD에 달 수를 더한다. 그 달에 같은 날이 없으면 말일(3월 31일 → 2월 28일). */
export function addMonthsToDate(date: string, months: number): string {
  const month = addMonths(monthOf(date), months);
  const lastDay = daysBetween(`${month}-01`, `${addMonths(month, 1)}-01`);
  const day = Math.min(Number(date.slice(8)), lastDay);
  return `${month}-${String(day).padStart(2, "0")}`;
}

/**
 * 달력 키보드 이동. 방향키 ±1일·±7일, Home/End는 그 주의 일·토요일,
 * PageUp/PageDown은 전·다음 달 같은 날(없으면 말일). 모르는 키는 null.
 */
export function shiftCalendarDate(date: string, key: string): string | null {
  switch (key) {
    case "ArrowLeft":
      return addKstDays(date, -1);
    case "ArrowRight":
      return addKstDays(date, 1);
    case "ArrowUp":
      return addKstDays(date, -7);
    case "ArrowDown":
      return addKstDays(date, 7);
    case "Home":
      return addKstDays(date, -weekdayIndex(date));
    case "End":
      return addKstDays(date, 6 - weekdayIndex(date));
    case "PageUp":
      return addMonthsToDate(date, -1);
    case "PageDown":
      return addMonthsToDate(date, 1);
    default:
      return null;
  }
}

/** ISO 시각의 한국 시각(HH:mm)은 그대로 두고 한국 날짜만 바꾼다(끌어다 놓기로 날짜 옮기기). */
export function withKstDate(iso: string, date: string): string {
  return toKstIsoDateTime(date, formatKstTime(new Date(iso)));
}

/** 요일 번호(일요일 0 ~ 토요일 6). 달력 날짜 자체의 요일이라 UTC 자정으로 계산한다. */
function weekdayIndex(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 달력 머리에 쓰는 요일 이름(일요일부터). */
export const WEEKDAY_LABELS: readonly string[] = WEEKDAYS;

/** YYYY-MM-DD(한국 날짜)의 요일 한 글자. 예: "화" */
export function kstWeekday(date: string): string {
  // 달력 날짜 자체의 요일이므로 UTC 자정으로 계산해도 된다.
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

/**
 * 만 나이. birthDate·today는 YYYY-MM-DD(한국 날짜).
 * 형식이 틀리거나 생일이 기준일보다 뒤면 null.
 */
export function fullAge(
  birthDate: string,
  today: string = formatKstDate(),
): number | null {
  if (!isIsoDate(birthDate) || !isIsoDate(today)) return null;
  const age =
    Number(today.slice(0, 4)) -
    Number(birthDate.slice(0, 4)) -
    (today.slice(5) < birthDate.slice(5) ? 1 : 0);
  return age >= 0 ? age : null;
}

/**
 * 연·월·일 칸의 자릿수. 월이 2~9로 시작하거나 13 이상이면 한 자리 월,
 * 일이 4~9로 시작하거나 32 이상이면 한 자리 일로 본다("2026922" → 9월 22일).
 */
function datePartLength(index: number, part: string): number {
  if (index === 0) return 4;
  if (index === 1) return /^([2-9]|1[3-9])/.test(part) ? 1 : 2;
  return /^([4-9]|3[2-9])/.test(part) ? 1 : 2;
}

/**
 * 날짜 칸에 입력 중인 글자를 "YYYY-MM-DD" 꼴로 다듬는다(달력 입력 칸).
 * 숫자만 치면 자리에 맞춰 하이픈을 넣고("20261021" → "2026-10-21"),
 * 구분자(- . / 공백)를 직접 치면 그 자리를 지킨다("2026.1.5" → "2026-1-5").
 */
export function formatDateTyping(raw: string): string {
  const parts = raw
    .replace(/[./\s]/g, "-")
    .replace(/[^\d-]/g, "")
    .replace(/-+/g, "-")
    .split("-");
  let text = "";
  let carry = "";
  for (let i = 0; i < 3; i++) {
    const part = carry + (parts[i] ?? "");
    const length = datePartLength(i, part);
    text += part.slice(0, length);
    carry = part.slice(length);
    // 넘친 숫자가 있거나 구분자를 쳤으면 다음 칸으로 넘어간다.
    const next = carry !== "" || parts.length > i + 1;
    if (i === 2 || !next) break;
    text += "-";
  }
  return text;
}

/** 한 자리 월·일을 두 자리로: "2026-1-5" → "2026-01-05". 다른 꼴은 그대로 둔다. */
export function normalizeDateTyping(text: string): string {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  return match
    ? `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`
    : text;
}

/** "2026-09-22" → "9월 22일 (화)" */
export function formatDateLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}월 ${day}일 (${kstWeekday(date)})`;
}

/** "2026-09" → "2026년 9월" */
export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}년 ${monthNumber}월`;
}
