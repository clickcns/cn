import type { RecordCursor } from "@repo/shared-types";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { resolveOrganizationFilter } from "../core/utils/org-scope.js";
import type { Prisma } from "../generated/prisma/client.js";

/**
 * 지난 기록으로 볼 수 있는 방문: 확정 기록(작성자·직종 무관) + 본인의 작성 중 기록.
 * 예정 방문은 서식 값이 없어 빠진다. 다른 직원의 작성 중 기록은 확정 전이라 보이지 않는다.
 */
export function visibleRecordWhere(actorId: string): Prisma.VisitWhereInput {
  return {
    OR: [{ status: "CONFIRMED" }, { status: "DRAFT", staffId: actorId }],
  };
}

/**
 * 한 수급자의 지난 기록 조회 조건.
 * - 기관 범위: 운영자는 모든 기관, 그 외는 자기 기관
 * - anchor: 그 방문보다 앞선 기록(같은 시각의 다른 방문 포함 — 의사·간호사 동행 방문)
 * - cursor: 최신순(방문 일시 → id 내림차순)으로 그 다음부터
 */
export function recordHistoryWhere({
  actor,
  recipientId,
  anchor,
  cursor,
}: {
  actor: AuthenticatedUser;
  recipientId: string;
  anchor?: RecordCursor | null;
  cursor?: RecordCursor | null;
}): Prisma.VisitWhereInput {
  const conditions: Prisma.VisitWhereInput[] = [visibleRecordWhere(actor.id)];
  if (anchor) {
    conditions.push({
      scheduledAt: { lte: anchor.scheduledAt },
      id: { not: anchor.id },
    });
  }
  if (cursor) {
    conditions.push({
      OR: [
        { scheduledAt: { lt: cursor.scheduledAt } },
        { scheduledAt: cursor.scheduledAt, id: { lt: cursor.id } },
      ],
    });
  }
  return {
    recipientId,
    organizationId: resolveOrganizationFilter(actor),
    AND: conditions,
  };
}

/** 지난 기록 정렬: 최신순(같은 시각이면 id 내림차순 — cursor 와 같은 순서). */
export const recordHistoryOrderBy = [
  { scheduledAt: "desc" },
  { id: "desc" },
] as const satisfies Prisma.VisitOrderByWithRelationInput[];
