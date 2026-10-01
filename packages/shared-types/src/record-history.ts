import { z } from "zod";
import { formatKstDate } from "./date.js";
import {
  FORM_IDS,
  FORMS,
  formFields,
  isEmptyValue,
  numberPairOf,
  sanitizeFieldValue,
  type FieldDef,
  type FieldValue,
  type FormId,
  type VisitForms,
} from "./forms/index.js";
import { isoDateTime } from "./schema.js";
import type { VisitBase } from "./visit.js";

/*
 * 지난 기록(과거력): 같은 수급자의 이전 방문 기록. 같은 기관에서 확정한 기록은 작성자·직종과 상관없이
 * 읽기 전용으로 보고, 확정 전 기록은 본인 것만 본다. 기록 화면은 이 방문을 기준으로 그 전 기록을
 * 최신순으로 받아 서식 전체·구분·칸 단위로 다시 쓴다.
 */

export const RECORD_HISTORY_DEFAULT_LIMIT = 10;
/** 기록마다 서식 값을 싣으므로 한 번에 많이 주지 않는다. */
export const RECORD_HISTORY_MAX_LIMIT = 30;

/** 다음 쪽 위치: 마지막 기록의 방문 일시와 id(같은 시각이면 id 순). */
export interface RecordCursor {
  scheduledAt: Date;
  id: string;
}

const CURSOR_SEPARATOR = "_";
const cursorDateSchema = isoDateTime("잘못된 cursor입니다");
const cursorIdSchema = z.uuid();

export function encodeRecordCursor(record: {
  scheduledAt: string;
  id: string;
}): string {
  return `${record.scheduledAt}${CURSOR_SEPARATOR}${record.id}`;
}

/** 잘못된 값이면 null. */
export function decodeRecordCursor(cursor: string): RecordCursor | null {
  const at = cursor.lastIndexOf(CURSOR_SEPARATOR);
  const scheduledAt = cursorDateSchema.safeParse(cursor.slice(0, at));
  const id = cursorIdSchema.safeParse(cursor.slice(at + 1));
  if (at < 0 || !scheduledAt.success || !id.success) return null;
  return { scheduledAt: new Date(scheduledAt.data), id: id.data };
}

export const RecipientRecordQuerySchema = z.object({
  /** 이 방문보다 앞선(같은 시각 포함, 이 방문은 빼고) 기록만. 기록 화면이 지금 방문을 넣는다. */
  beforeVisitId: z.uuid().optional(),
  /** 앞 쪽 응답의 nextCursor */
  cursor: z
    .string()
    .refine(
      (value) => decodeRecordCursor(value) !== null,
      "잘못된 cursor입니다",
    )
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RECORD_HISTORY_MAX_LIMIT)
    .default(RECORD_HISTORY_DEFAULT_LIMIT),
});
export type RecipientRecordQuery = z.input<typeof RecipientRecordQuerySchema>;

/** 지난 기록 한 건: 방문 정보와 저장한 서식 값(그때의 서식 정의로 검사한 값). 확정, 또는 본인의 작성 중. */
export interface RecipientRecord extends VisitBase {
  forms: VisitForms;
}

export interface RecipientRecordPage {
  /** 최신순 */
  items: RecipientRecord[];
  /** 더 있으면 다음 쪽 cursor */
  nextCursor: string | null;
}

/** 기록의 방문 날짜(한국 날짜): 실제 시작 시각, 없으면 예정 시각. */
export function recordDate(
  record: Pick<RecipientRecord, "startedAt" | "scheduledAt">,
): string {
  return formatKstDate(new Date(record.startedAt ?? record.scheduledAt));
}

/** 칸의 지난 값과 그 값을 적은 기록. */
export interface PastFieldValue {
  value: FieldValue;
  /** 그 기록의 방문 날짜(한국 날짜) */
  date: string;
  /** 확정 전(본인 작성 중) 기록의 값 */
  draft: boolean;
}

/** 칸 키 → 지난 값 */
export type PastFieldValues = Record<string, PastFieldValue>;

/** 서식의 칸을 숫자 짝(혈압 수축기/이완기)은 묶어서. */
function fieldGroups(formId: FormId): FieldDef[][] {
  const form = FORMS[formId];
  const fields = formFields(form);
  const groups: FieldDef[][] = [];
  for (const field of fields) {
    const pair = numberPairOf(form, field.key);
    if (pair && pair.keys[0] !== field.key) continue;
    groups.push(
      pair
        ? fields.filter((candidate) => pair.keys.includes(candidate.key))
        : [field],
    );
  }
  return groups;
}

/**
 * 서식의 칸마다 가장 최근에 적은 값(records 는 최신순). 그 기록에서 비어 있으면 더 앞 기록에서 찾는다.
 * 숫자 짝은 두 칸을 같은 기록에서 함께 가져온다. 지금 서식 정의에 맞지 않는 값은 버린다.
 */
export function latestFieldValues(
  records: readonly RecipientRecord[],
  formId: FormId,
): PastFieldValues {
  const result: PastFieldValues = {};
  for (const group of fieldGroups(formId)) {
    for (const record of records) {
      const data = record.forms[formId];
      if (!data) continue;
      const values = group.map(
        (field) =>
          [field.key, sanitizeFieldValue(field, data[field.key])] as const,
      );
      if (values.every(([, value]) => isEmptyValue(value))) continue;
      for (const [key, value] of values) {
        if (isEmptyValue(value)) continue;
        result[key] = {
          value,
          date: recordDate(record),
          draft: record.status === "DRAFT",
        };
      }
      break;
    }
  }
  return result;
}

/** 기록에 나오는 서식마다 칸별 지난 값. */
export function latestFieldValuesByForm(
  records: readonly RecipientRecord[],
): Partial<Record<FormId, PastFieldValues>> {
  return Object.fromEntries(
    FORM_IDS.filter((formId) =>
      records.some((record) => record.forms[formId]),
    ).map((formId) => [formId, latestFieldValues(records, formId)]),
  );
}
