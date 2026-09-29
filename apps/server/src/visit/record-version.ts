import { createHash } from "node:crypto";
import type {
  FormId,
  Profession,
  Program,
  VisitForms,
  VisitRecordSnapshot,
} from "@repo/shared-types";
import { fromDbDate } from "../core/utils/db-date.js";
import type { Prisma } from "../generated/prisma/client.js";
import { toCareGrade } from "../recipient/recipient.mapper.js";

/*
 * 확정본(VisitRecordVersion) 만들기와 위변조 확인. DB 없이 계산하므로 단위 테스트한다.
 */

/**
 * 키를 정렬한 JSON. 같은 값이면 키 순서와 상관없이 같은 문자열이 나온다(해시 입력).
 * JSON.stringify처럼 undefined인 속성은 뺀다. DB(jsonb)에 넣었다 꺼내도 결과가 같다.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export interface RecordVersionHashInput {
  visitId: string;
  version: number;
  confirmedById: string;
  confirmedAt: Date;
  snapshot: VisitRecordSnapshot;
}

/** 확정본의 SHA-256(16진수). 방문·차수·확정자·확정 시각까지 넣어 다른 확정본과 바꿔치기해도 드러난다. */
export function recordVersionHash({
  visitId,
  version,
  confirmedById,
  confirmedAt,
  snapshot,
}: RecordVersionHashInput): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        visitId,
        version,
        confirmedById,
        confirmedAt: confirmedAt.toISOString(),
        snapshot,
      }),
    )
    .digest("hex");
}

/** 확정본 행에 넣을 값(보관 값 + 해시). 서비스(확정·되돌리기)와 시드가 함께 쓴다. */
export function recordVersionData(input: RecordVersionHashInput) {
  return {
    ...input,
    snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
    hash: recordVersionHash(input),
  };
}

/** 서식 머리로 보관할 기관·수급자·담당자 정보. 확정·되돌리기·시드가 같은 모양으로 읽는다. */
export const recordHeaderSelect = {
  organization: { select: { name: true, code: true } },
  recipient: {
    select: {
      name: true,
      chartNumber: true,
      birthDate: true,
      gender: true,
      careGrade: true,
      ltcCertNumber: true,
      address: true,
    },
  },
  staff: { select: { name: true, licenseNumber: true } },
} as const satisfies Prisma.VisitSelect;
export type RecordHeaderRow = Prisma.VisitGetPayload<{
  select: typeof recordHeaderSelect;
}>;

/**
 * 확정할 때의 기록 값. 서식은 이 방문의 서식만 서식 순서대로 담고, 서식 머리는 그때의
 * 기관·수급자·담당자 정보로 채운다.
 */
export function toRecordSnapshot(
  visit: {
    program: Program;
    profession: Profession;
    staffId: string;
    formIds: readonly FormId[];
    startedAt: Date | null;
    endedAt: Date | null;
  },
  forms: VisitForms,
  { organization, recipient, staff }: RecordHeaderRow,
): VisitRecordSnapshot {
  return {
    program: visit.program,
    profession: visit.profession,
    staffId: visit.staffId,
    formIds: [...visit.formIds],
    forms: Object.fromEntries(
      visit.formIds.flatMap((formId) =>
        forms[formId] ? [[formId, forms[formId]]] : [],
      ),
    ),
    startedAt: visit.startedAt?.toISOString() ?? null,
    endedAt: visit.endedAt?.toISOString() ?? null,
    header: {
      organization,
      recipient: {
        ...recipient,
        birthDate: fromDbDate(recipient.birthDate),
        careGrade: toCareGrade(recipient.careGrade),
      },
      staff,
    },
  };
}
