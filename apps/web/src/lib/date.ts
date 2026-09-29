import {
  addKstDays,
  formatDateLabel,
  formatKstDate,
  formatKstTime,
} from "@repo/shared-types";

/** "2026-09-22" → "9월 22일 (화)" (관리 웹과 함께 쓴다) */
export { formatDateLabel };

/** 기준일과 비교한 "오늘"·"내일"·"어제". 그 밖의 날은 null. */
export function relativeDayLabel(date: string, today: string): string | null {
  if (date === today) return "오늘";
  if (date === addKstDays(today, 1)) return "내일";
  if (date === addKstDays(today, -1)) return "어제";
  return null;
}

/** ISO 시각 → "9월 22일 (화) 09:00" (한국 시간) */
export function formatDateTimeLabel(iso: string): string {
  const date = new Date(iso);
  return `${formatDateLabel(formatKstDate(date))} ${formatKstTime(date)}`;
}

/** ISO 시각 → "09:00" (한국 시간) */
export function formatTimeLabel(iso: string): string {
  return formatKstTime(new Date(iso));
}

/** ISO 시각 두 개 사이의 실제 경과 시간(분). 자정을 넘겨도 맞다. 순서가 거꾸로면 null. */
export function minutesBetween(start: string, end: string): number | null {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return diff >= 0 ? Math.round(diff / 60_000) : null;
}
