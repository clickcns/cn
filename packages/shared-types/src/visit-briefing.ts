import {
  formatFieldValue,
  formFields,
  isEmptyValue,
  type FieldDef,
  type FieldValue,
  type SelectedOption,
} from "./forms/engine.js";
import { FORMS, type FormId } from "./forms/index.js";
import { sanitizeFieldValue, withoutMinutes } from "./forms/reuse.js";
import type { Program } from "./programs.js";
import { recordDate, type RecipientRecord } from "./record-history.js";
import { PROFESSIONS, type Profession } from "./roles.js";

/*
 * 방문 전 브리핑: 지난 기록에서 정한 칸만 그대로 보여 준다(해석·요약하지 않는다). 직종 × 사업마다 가장
 * 최근 기록 하나에서 뽑아 같은 날짜의 내용끼리만 묶는다. 서식 칸을 바꾸면 BRIEFING_FIELDS도 고친다
 * (visit-briefing.spec.ts가 칸·선택지가 서식에 있는지 본다).
 */

/** 보이는 순서: 간호지시 → 계획 → 살펴볼 것 → 한 일 → 메모 */
export const BRIEFING_KINDS = [
  "order",
  "plan",
  "issue",
  "care",
  "note",
] as const;
export type BriefingKind = (typeof BRIEFING_KINDS)[number];

export const BRIEFING_KIND_LABELS: Record<BriefingKind, string> = {
  order: "간호지시",
  plan: "계획",
  issue: "살펴볼 것",
  care: "한 일",
  note: "메모",
};

export interface BriefingFieldRef {
  formId: FormId;
  key: string;
  kind: BriefingKind;
  /** 이 선택지를 골랐을 때만 보인다(나머지는 빼고). */
  values?: readonly string[];
  /** 유/무 칸: "유"(YES)를 골랐을 때만 "있었음"으로 보인다. */
  presence?: true;
}

export const BRIEFING_FIELDS: readonly BriefingFieldRef[] = [
  // 제6호 방문점검 기록지(의사)
  { formId: "HOME_CARE_DOCTOR", key: "nursingOrders", kind: "order" },
  { formId: "HOME_CARE_DOCTOR", key: "plan", kind: "plan" },
  {
    formId: "HOME_CARE_DOCTOR",
    key: "physicalTrend",
    kind: "issue",
    values: ["IMPROVED", "WORSENED"],
  },
  {
    formId: "HOME_CARE_DOCTOR",
    key: "cognitiveTrend",
    kind: "issue",
    values: ["IMPROVED", "WORSENED"],
  },
  { formId: "HOME_CARE_DOCTOR", key: "consultation", kind: "care" },
  { formId: "HOME_CARE_DOCTOR", key: "invasive", kind: "care" },
  { formId: "HOME_CARE_DOCTOR", key: "otherActions", kind: "care" },
  { formId: "HOME_CARE_DOCTOR", key: "summary", kind: "note" },
  { formId: "HOME_CARE_DOCTOR", key: "notes", kind: "note" },
  // 제4호 일차의료 방문진료 점검서식
  { formId: "PRIMARY_CARE_CHECK", key: "plan", kind: "plan" },
  { formId: "PRIMARY_CARE_CHECK", key: "visitReason", kind: "issue" },
  { formId: "PRIMARY_CARE_CHECK", key: "treatment", kind: "care" },
  // 제7호 방문점검 기록지(간호사)
  { formId: "HOME_CARE_NURSE", key: "plan", kind: "plan" },
  { formId: "HOME_CARE_NURSE", key: "delirium", kind: "issue", presence: true },
  { formId: "HOME_CARE_NURSE", key: "fall", kind: "issue", presence: true },
  {
    formId: "HOME_CARE_NURSE",
    key: "incontinence",
    kind: "issue",
    presence: true,
  },
  { formId: "HOME_CARE_NURSE", key: "care", kind: "care" },
  { formId: "HOME_CARE_NURSE", key: "summary", kind: "note" },
  { formId: "HOME_CARE_NURSE", key: "notes", kind: "note" },
  // 제8호 업무기록(사회복지사)
  { formId: "HOME_CARE_SOCIAL", key: "content", kind: "care" },
  { formId: "HOME_CARE_SOCIAL", key: "linkServices", kind: "care" },
  { formId: "HOME_CARE_SOCIAL", key: "counselDetail", kind: "note" },
  { formId: "HOME_CARE_SOCIAL", key: "linkDetail", kind: "note" },
  { formId: "HOME_CARE_SOCIAL", key: "notes", kind: "note" },
  // 제14호 급여제공기록지(장기요양 방문간호)
  { formId: "LTC_NURSING", key: "nextPlan", kind: "plan" },
  { formId: "LTC_NURSING", key: "nursingCare", kind: "care" },
  { formId: "LTC_NURSING", key: "healthCare", kind: "care" },
  { formId: "LTC_NURSING", key: "specialNote", kind: "note" },
];

export interface BriefingItem {
  formId: FormId;
  key: string;
  /** 칸 이름(서식 정의) */
  label: string;
  kind: BriefingKind;
  text: string;
}

/** 한 직종(× 사업)의 가장 최근 기록에서 뽑은 내용. */
export interface BriefingSource {
  profession: Profession;
  program: Program;
  recordId: string;
  /** 방문 날짜(한국 날짜) */
  date: string;
  staffName: string;
  /** 아직 확정하지 않은 본인 기록 */
  draft: boolean;
  items: BriefingItem[];
}

const FIELDS = new Map<string, FieldDef>(
  BRIEFING_FIELDS.flatMap((ref) => {
    const field = formFields(FORMS[ref.formId]).find(
      (candidate) => candidate.key === ref.key,
    );
    return field ? [[`${ref.formId}.${ref.key}`, field] as const] : [];
  }),
);

/** 고르는 칸이면 정한 선택지만 남긴다. 남은 것이 없으면 null. */
function pickOptions(
  field: FieldDef,
  value: FieldValue,
  values: readonly string[] | undefined,
): FieldValue {
  if (!values) return value;
  if (field.type === "single") {
    return values.includes((value as SelectedOption).value) ? value : null;
  }
  if (field.type === "multi") {
    const kept = (value as SelectedOption[]).filter((selected) =>
      values.includes(selected.value),
    );
    return kept.length > 0 ? kept : null;
  }
  return value;
}

/** 기록 한 건에서 브리핑에 보일 칸: 종류 순서, 같은 종류는 BRIEFING_FIELDS 순서. */
function briefingItems(record: Pick<RecipientRecord, "forms">): BriefingItem[] {
  const items: BriefingItem[] = [];
  for (const ref of BRIEFING_FIELDS) {
    const data = record.forms[ref.formId];
    const field = FIELDS.get(`${ref.formId}.${ref.key}`);
    if (!data || !field) continue;
    const stored = sanitizeFieldValue(field, data[ref.key]);
    if (isEmptyValue(stored)) continue;
    const value = withoutMinutes(
      field,
      pickOptions(field, stored, ref.presence ? ["YES"] : ref.values),
    );
    if (isEmptyValue(value)) continue;
    const text = ref.presence ? "있었음" : formatFieldValue(field, value);
    if (!text) continue;
    items.push({
      formId: ref.formId,
      key: ref.key,
      label: field.label,
      kind: ref.kind,
      text,
    });
  }
  return items.sort(
    (a, b) => BRIEFING_KINDS.indexOf(a.kind) - BRIEFING_KINDS.indexOf(b.kind),
  );
}

/**
 * 지난 기록(최신순)에서 직종 × 사업마다 보일 칸이 있는 가장 최근 기록 하나씩. 직종 순서(의사·간호사·
 * 사회복지사)로.
 */
export function buildVisitBriefing(
  records: readonly RecipientRecord[],
): BriefingSource[] {
  const sources = new Map<string, BriefingSource>();
  for (const record of records) {
    const group = `${record.profession}:${record.program}`;
    if (sources.has(group)) continue;
    const items = briefingItems(record);
    if (items.length === 0) continue;
    sources.set(group, {
      profession: record.profession,
      program: record.program,
      recordId: record.id,
      date: recordDate(record),
      staffName: record.staff.name,
      draft: record.status !== "CONFIRMED",
      items,
    });
  }
  return [...sources.values()].sort(
    (a, b) =>
      PROFESSIONS.indexOf(a.profession) - PROFESSIONS.indexOf(b.profession),
  );
}

export interface BriefingHighlight {
  source: BriefingSource;
  item: BriefingItem;
}

/**
 * 보는 사람(방문한 직종) 기준: 간호사에게는 최근 의사 기록의 간호지시를, 누구에게나 본인 직종의 계획을
 * 맨 위로(기록마다 첫 계획 칸 하나 — 의사는 제6호·제4호 둘 다 적으므로). 묶음은 본인 직종을 먼저 보인다.
 */
export function briefingForViewer(
  sources: readonly BriefingSource[],
  viewer: Profession,
): { highlights: BriefingHighlight[]; sources: BriefingSource[] } {
  const pick = (source: BriefingSource, kind: BriefingKind) =>
    source.items
      .filter((item) => item.kind === kind)
      .map((item) => ({ source, item }));
  const own = sources.filter((source) => source.profession === viewer);
  return {
    highlights: [
      // 간호지시는 의사 서식에만 있고 간호사가 따른다
      ...(viewer === "NURSE"
        ? sources.flatMap((source) => pick(source, "order"))
        : []),
      ...own.flatMap((source) => pick(source, "plan").slice(0, 1)),
    ],
    sources: [
      ...own,
      ...sources.filter((source) => source.profession !== viewer),
    ],
  };
}
