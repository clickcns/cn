import type { Profession, VisitCalendarItem } from "@repo/shared-types";

/**
 * 이 수급자를 이 직종으로 가장 최근에 방문한(예정 포함) 활성 담당자. 재택의료 수입에서
 * [방문 잡기]로 여는 등록 창의 담당자 기본값이다. 없으면 undefined(등록 창에서 고른다).
 */
export function lastStaffId(
  items: readonly VisitCalendarItem[],
  recipientId: string,
  profession: Profession,
): string | undefined {
  let latest: VisitCalendarItem | undefined;
  for (const item of items) {
    if (
      item.recipient.id === recipientId &&
      item.profession === profession &&
      item.staff.isActive &&
      (!latest || item.scheduledAt > latest.scheduledAt)
    ) {
      latest = item;
    }
  }
  return latest?.staff.id;
}
