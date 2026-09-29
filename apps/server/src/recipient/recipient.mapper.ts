import type {
  CareGrade,
  Recipient,
  VisitRecipient,
  VisitRecipientSummary,
} from "@repo/shared-types";
import { fromDbDate } from "../core/utils/db-date.js";
import type { Prisma } from "../generated/prisma/client.js";

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
  chartNumber: true,
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
    chartNumber: row.chartNumber,
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
    programs: row.programs,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
