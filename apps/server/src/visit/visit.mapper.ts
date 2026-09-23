import type {
  FormData,
  FormId,
  VisitDetail,
  VisitForms,
  VisitSummary,
} from "@repo/shared-types";
import type { Prisma } from "../generated/prisma/client.js";
import {
  toVisitRecipient,
  toVisitRecipientSummary,
  visitRecipientSelect,
  visitRecipientSummarySelect,
} from "../recipient/recipient.mapper.js";

const staffSelect = {
  select: { id: true, name: true, profession: true },
} as const;

/** 목록: 서식 값은 싣지 않고, 수급자는 목록에 필요한 필드만. */
export const visitSummaryArgs = {
  include: {
    recipient: { select: visitRecipientSummarySelect },
    staff: staffSelect,
  },
} as const satisfies Prisma.VisitDefaultArgs;

export const visitDetailArgs = {
  include: {
    recipient: { select: visitRecipientSelect },
    staff: { select: { ...staffSelect.select, licenseNumber: true } },
    organization: { select: { name: true, code: true } },
    forms: { select: { formId: true, data: true } },
  },
} as const satisfies Prisma.VisitDefaultArgs;

type VisitSummaryRow = Prisma.VisitGetPayload<typeof visitSummaryArgs>;
export type VisitDetailRow = Prisma.VisitGetPayload<typeof visitDetailArgs>;

/** 방문을 만들 때 FORM_IDS 안에서 정해 저장하므로 문자열 배열 컬럼을 그대로 좁힌다. */
export function toFormIds(formIds: string[]): FormId[] {
  return formIds as FormId[];
}

function toVisitBase(row: VisitSummaryRow | VisitDetailRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    program: row.program,
    status: row.status,
    scheduledAt: row.scheduledAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    staff: row.staff,
    formIds: toFormIds(row.formIds),
  };
}

export function toVisitSummary(row: VisitSummaryRow): VisitSummary {
  return {
    ...toVisitBase(row),
    recipient: toVisitRecipientSummary(row.recipient),
  };
}

/** 저장한 서식 값. 저장할 때 서식 정의로 검사한 값만 들어간다. */
export function toVisitForms(
  rows: readonly { formId: string; data: Prisma.JsonValue }[],
): VisitForms {
  return Object.fromEntries(
    rows.map((row) => [row.formId, row.data as FormData]),
  );
}

export function toVisitDetail(
  row: VisitDetailRow,
  carryOver: VisitForms,
): VisitDetail {
  return {
    ...toVisitBase(row),
    recipient: toVisitRecipient(row.recipient),
    organization: row.organization,
    staff: row.staff,
    forms: toVisitForms(row.forms),
    carryOver,
  };
}
