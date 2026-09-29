/*
 * 날짜만 있는 열(@db.Date). Prisma는 UTC 자정의 Date로 주고받는다.
 */

/** "YYYY-MM-DD"를 @db.Date 값으로. undefined는 "변경 없음". */
export function toDbDate(
  date: string | null | undefined,
): Date | null | undefined {
  if (date === undefined) return undefined;
  if (date === null) return null;
  return new Date(`${date}T00:00:00.000Z`);
}

/** @db.Date 값을 "YYYY-MM-DD"로. */
export function fromDbDate(date: Date): string;
export function fromDbDate(date: Date | null): string | null;
export function fromDbDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
