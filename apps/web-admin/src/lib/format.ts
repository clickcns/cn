import {
  CARE_GRADE_LABELS,
  formatKstDate,
  formatKstTime,
  fullAge,
  GENDER_LABELS,
  kstWeekday,
  type CareGrade,
  type Gender,
} from "@repo/shared-types";

/** 화면 표시는 모두 한국 시간 기준이다. 값이 없으면 대시로 표시한다. */
const EMPTY = "—";

type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 2026-09-22 (화) 14:30 */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return EMPTY;
  const day = formatKstDate(date);
  return `${day} (${kstWeekday(day)}) ${formatKstTime(date)}`;
}

/** 2026-09-22 */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  return date ? formatKstDate(date) : EMPTY;
}

/** 14:30 */
export function formatTime(value: DateInput): string {
  const date = toDate(value);
  return date ? formatKstTime(date) : EMPTY;
}

/**
 * 방문 시작 ~ 종료. 같은 날이면 시각만("14:30 ~ 15:10") 보인다.
 * 시작일이 예정일과 다르거나 종료일이 시작일과 다르면(자정을 넘김) 날짜까지 보인다.
 * 예: "2026-09-23 (수) 23:40 ~ 2026-09-24 (목) 00:20"
 */
export function formatVisitTimeRange(
  scheduledAt: DateInput,
  startedAt: DateInput,
  endedAt: DateInput,
): string {
  const kstDay = (value: DateInput) => {
    const date = toDate(value);
    return date ? formatKstDate(date) : null;
  };
  const scheduledDay = kstDay(scheduledAt);
  const startDay = kstDay(startedAt);
  const endDay = kstDay(endedAt);
  const withDate =
    (startDay !== null && startDay !== scheduledDay) ||
    (endDay !== null && endDay !== (startDay ?? scheduledDay));
  const format = withDate ? formatDateTime : formatTime;
  return `${format(startedAt)} ~ ${format(endedAt)}`;
}

/** 두 시각 사이의 길이. 예: "1시간 5분", "45분" */
export function formatDuration(start: DateInput, end: DateInput): string {
  if (!start || !end) return EMPTY;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return EMPTY;
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
}

/** 1942-03-05 (만 84세) */
export function formatBirthDate(birthDate: string | null | undefined): string {
  if (!birthDate) return EMPTY;
  const age = fullAge(birthDate);
  return age === null ? birthDate : `${birthDate} (만 ${age}세)`;
}

/** 3등급 */
export function formatCareGrade(
  careGrade: CareGrade | null | undefined,
): string {
  return careGrade ? CARE_GRADE_LABELS[careGrade] : EMPTY;
}

/** 남 · 여 */
export function formatGender(gender: Gender | null | undefined): string {
  return gender ? GENDER_LABELS[gender] : EMPTY;
}

/** 값이 없으면 대시로 표시한다. */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  return String(value);
}

/** 사람 목록의 건수와 활성 수: "3명 · 활성 3명" (기관별 묶음 머리 줄) */
export function formatActiveCount(rows: readonly { isActive: boolean }[]) {
  const active = rows.filter((row) => row.isActive).length;
  return `${rows.length}명 · 활성 ${active}명`;
}
