import type {
  CareGrade,
  Recipient,
  VisitRecipient,
  VisitRecipientSummary,
} from "@repo/shared-types";
import type { Prisma } from "../generated/prisma/client.js";

/** DB에는 @db.Date(UTC 자정)로 저장한다. undefined는 "변경 없음". */
export function toDbDate(
  date: string | null | undefined,
): Date | null | undefined {
  if (date === undefined) return undefined;
  if (date === null) return null;
  return new Date(`${date}T00:00:00.000Z`);
}

function fromDbDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** 입력 시 CARE_GRADES로 검증해 저장하므로 문자열 컬럼을 그대로 좁힌다. */
export function toCareGrade(value: string | null): CareGrade | null {
  return value as CareGrade | null;
}

/** 방문 목록용: 연락처·보호자·메모는 싣지 않는다. */
export const visitRecipientSummarySelect = {
  id: true,
  name: true,
  careGrade: true,
  address: true,
} as const satisfies Prisma.RecipientSelect;

/** 방문 상세용. */
export const visitRecipientSelect = {
  ...visitRecipientSummarySelect,
  birthDate: true,
  gender: true,
  phone: true,
  guardianName: true,
  guardianPhone: true,
  notes: true,
  ltcCertNumber: true,
} as const satisfies Prisma.RecipientSelect;

type RecipientSummaryRow = Prisma.RecipientGetPayload<{
  select: typeof visitRecipientSummarySelect;
}>;
type VisitRecipientRow = Prisma.RecipientGetPayload<{
  select: typeof visitRecipientSelect;
}>;
type RecipientRow = Prisma.RecipientGetPayload<object>;

export function toVisitRecipientSummary(
  row: RecipientSummaryRow,
): VisitRecipientSummary {
  return {
    id: row.id,
    name: row.name,
    careGrade: toCareGrade(row.careGrade),
    address: row.address,
  };
}

export function toVisitRecipient(row: VisitRecipientRow): VisitRecipient {
  return {
    ...toVisitRecipientSummary(row),
    birthDate: fromDbDate(row.birthDate),
    gender: row.gender,
    phone: row.phone,
    guardianName: row.guardianName,
    guardianPhone: row.guardianPhone,
    notes: row.notes,
    ltcCertNumber: row.ltcCertNumber,
  };
}

export function toRecipient(row: RecipientRow): Recipient {
  return {
    ...toVisitRecipient(row),
    organizationId: row.organizationId,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
