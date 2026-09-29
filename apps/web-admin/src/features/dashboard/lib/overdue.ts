import type { VisitStatus } from "@repo/shared-types";

/** 현황판에 보여 주는 지난 미확정 방문 수(오래된 것부터). 나머지는 방문 목록에서 본다. */
export const OVERDUE_ROWS = 10;

/** 지난 방문 중 확정하지 않은 상태: 예정 그대로(방문·기록 없음)와 작성 중. */
export const OVERDUE_STATUSES = [
  "SCHEDULED",
  "DRAFT",
] as const satisfies readonly VisitStatus[];
