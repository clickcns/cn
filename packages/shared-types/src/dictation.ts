import {
  dictationFields,
  FORMS,
  formFields,
  isEmptyValue,
  numberPairOf,
  type FieldDef,
  type FormData,
  type FormId,
  type VisitForms,
} from "./forms/index.js";

/** 녹음 한 번의 최대 길이(초). */
export const DICTATION_MAX_SECONDS = 300;

/** 음성인식 결과를 나눈 문장. 초안은 id(S1, S2…)로 근거를 가리킨다. */
export interface DictationSentence {
  id: string;
  text: string;
  /** 몇 번째 녹음에서 나왔는지(1부터). 되묻기에 답한 녹음은 2, 3… */
  take: number;
  /** 그 녹음 안에서의 시각(초) */
  start: number;
  end: number;
}

/** 초안 값의 근거. ids는 문장 ID, quotes는 숫자 원문(형광펜으로 칠할 표기). */
export interface FieldEvidence {
  ids: string[];
  quotes: string[];
}

/**
 * 서식 한 장의 초안. values는 서식 값과 같은 모양이며 채운 칸만 있다.
 * evidence 키는 칸 키, 여러 항목을 고르는 칸이면 "칸키.항목값"이다.
 */
export interface FormDraft {
  values: FormData;
  evidence: Record<string, FieldEvidence>;
}

/** 초안 근거 키: 칸 키, 항목을 고르는 칸의 항목이면 "칸키.항목값". */
export function evidenceKey(fieldKey: string, optionValue?: string): string {
  return optionValue === undefined ? fieldKey : `${fieldKey}.${optionValue}`;
}

/** 칸 하나의 근거(항목별 근거까지 합친다). */
export function fieldEvidence(
  draft: FormDraft,
  fieldKey: string,
): FieldEvidence {
  const entries = Object.entries(draft.evidence).filter(
    ([key]) => key === fieldKey || key.startsWith(`${fieldKey}.`),
  );
  return {
    ids: [...new Set(entries.flatMap(([, evidence]) => evidence.ids))],
    quotes: entries.flatMap(([, evidence]) => evidence.quotes),
  };
}

/**
 * 방문의 서식별 초안. 말하지 않았거나 검사를 통과하지 못한 값은 비어 있다.
 * 초안을 만들 때 쓴 서식마다 키가 있으므로(채운 칸이 없어도), 키에 없는 서식은 그 뒤에 방문에 더한 서식이다.
 */
export type RecordDraft = Partial<Record<FormId, FormDraft>>;

/**
 * 자동 검사 결과.
 * - removed: 근거와 맞지 않아 초안에서 뺐다(예: 근거 문장에 없는 숫자).
 * - check: 초안에 남겼지만 간호사가 확인해야 한다.
 */
export interface DraftIssue {
  /** 예: "HOME_CARE_NURSE.pulse", "LTC_NURSING.nursingCare.PRESSURE_ULCER" */
  field: string;
  severity: "removed" | "check";
  message: string;
}

/** 빠진 항목과 되물을 질문. fields는 이 질문으로 채울 칸("서식ID.칸키")이다. */
export interface FollowUpQuestion {
  fields: string[];
  question: string;
}

export interface VisitDictation {
  id: string;
  visitId: string;
  sentences: DictationSentence[];
  draft: RecordDraft;
  issues: DraftIssue[];
  questions: FollowUpQuestion[];
  /** 초안을 만들지 못했을 때 이유. 문장은 남아 있으므로 다시 만들기를 할 수 있다. */
  draftError: string | null;
  /** 녹음 횟수 */
  takes: number;
  /** 녹음 길이 합(초) */
  audioSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface VisitDictationResponse {
  dictation: VisitDictation | null;
}

/**
 * 초안에서 이 서식들만 남긴다. 방문에서 뺀 서식의 초안 값·검사 결과·되묻기를 지울 때 쓴다
 * (여러 서식에 걸친 되묻기는 남은 서식의 칸만 남긴다).
 */
export function keepDraftForms(
  dictation: Pick<VisitDictation, "draft" | "issues" | "questions">,
  formIds: readonly FormId[],
): Pick<VisitDictation, "draft" | "issues" | "questions"> {
  const kept = (field: string) =>
    formIds.some((formId) => field.startsWith(`${formId}.`));
  return {
    draft: Object.fromEntries(
      formIds.flatMap((formId) => {
        const form = dictation.draft[formId];
        return form ? [[formId, form]] : [];
      }),
    ),
    issues: dictation.issues.filter((issue) => kept(issue.field)),
    questions: dictation.questions
      .map((question) => ({
        ...question,
        fields: question.fields.filter(kept),
      }))
      .filter((question) => question.fields.length > 0),
  };
}

/** 서식 칸 하나를 가리키는 "서식ID.칸키"(되묻기·검사 결과의 field 와 같은 모양). */
export type FormFieldRef = `${FormId}.${string}`;

/** "서식ID.칸키" → 서식과 칸 정의. 없는 서식·칸이면 null. */
export function resolveFieldRef(
  ref: string,
): { formId: FormId; field: FieldDef } | null {
  const dot = ref.indexOf(".");
  const formId = ref.slice(0, dot) as FormId;
  const key = ref.slice(dot + 1);
  const form = FORMS[formId] as (typeof FORMS)[FormId] | undefined;
  const field = form && formFields(form).find((f) => f.key === key);
  return field ? { formId, field } : null;
}

/** 칸 이름. 숫자 짝(혈압 수축기/이완기)은 짝 이름으로 부른다. */
function fieldLabel(formId: FormId, field: FieldDef): string {
  return numberPairOf(FORMS[formId], field.key)?.label ?? field.label;
}

/** 칸 이름들(띄어쓰기만 다른 같은 이름은 한 번: "향후 계획"·"향후계획"). */
function formFieldLabels(
  resolved: readonly { formId: FormId; field: FieldDef }[],
): string[] {
  const labels = new Map<string, string>();
  for (const { formId, field } of resolved) {
    const label = fieldLabel(formId, field);
    const key = label.replace(/\s/g, "");
    if (!labels.has(key)) labels.set(key, label);
  }
  return [...labels.values()];
}

/** 서식 한 장에서 초안이 값을 채운 칸. */
export interface FilledDraftForm {
  formId: FormId;
  draft: FormDraft;
  fields: FieldDef[];
}

/** 초안에서 값을 채운 칸(서식별, 방문 서식 순서). 초안을 만든 뒤 더한 서식(초안 키 없음)과 채운 칸이 없는 서식은 빠진다. */
export function filledDraftFields(
  dictation: Pick<VisitDictation, "draft">,
  formIds: readonly FormId[],
): FilledDraftForm[] {
  return formIds.flatMap((formId) => {
    const draft = dictation.draft[formId];
    if (!draft) return [];
    const fields = formFields(FORMS[formId]).filter(
      (field) => !isEmptyValue(draft.values[field.key]),
    );
    return fields.length > 0 ? [{ formId, draft, fields }] : [];
  });
}

/** 채운 항목 수. 빠진 항목(missingDictationItems)처럼 숫자 짝(혈압)은 한 항목으로 센다. */
export function filledItemCount(filled: readonly FilledDraftForm[]): number {
  return filled.reduce(
    (count, { formId, fields }) =>
      count +
      new Set(
        fields.map(
          (field) =>
            numberPairOf(FORMS[formId], field.key)?.keys[0] ?? field.key,
        ),
      ).size,
    0,
  );
}

/** 초안에서 빠진 항목 하나(여러 칸을 한 질문으로 물으면 한 항목). */
export interface MissingDictationItem {
  /** 이 항목의 칸("서식ID.칸키") */
  fields: string[];
  labels: string[];
  /** 확정 전에 꼭 채울 칸이 있다 */
  required: boolean;
  /** 되묻는 질문(서버가 초안과 함께 만든 것). 없으면 화면이 칸 종류로 안내한다 */
  question: string | null;
  /** 고르는 칸이면 고를 수 있는 항목 이름 */
  options: string[];
  /** 숫자 칸이면 단위 */
  unit: string | null;
}

function missingItem(
  refs: readonly string[],
  question: string | null,
): MissingDictationItem {
  const resolved = refs.flatMap((ref) => resolveFieldRef(ref) ?? []);
  const fields = resolved.map(({ field }) => field);
  const choice = fields.find(
    (field) => field.type === "single" || field.type === "multi",
  );
  const number = fields.find((field) => field.type === "number");
  return {
    fields: [...refs],
    labels: formFieldLabels(resolved),
    required: fields.some((field) => field.required === true),
    question,
    options: choice ? choice.options.map((option) => option.label) : [],
    unit: number?.unit ?? null,
  };
}

/**
 * 초안에서 빠진 항목: 서버가 되물은 질문(필수 칸·질문이 있는 칸·followUps)과, 질문은 없지만 비어 있는
 * 구술 칸(부가 항목, 숫자 짝은 한 항목)을 합쳐 필수 먼저 돌려준다(묶음 안은 질문 → 서식 칸 순서).
 * record 는 기록에 이미 있는 값(저장한 값, 없으면 이월 값)이다. 거기 값이 있는 칸은 빠진 것으로 보지 않고,
 * followUps 의 "이 중 하나" 묶음은 한 칸이라도 차 있으면 나머지를 묻지 않는다.
 */
export function missingDictationItems(
  dictation: Pick<VisitDictation, "draft" | "questions">,
  formIds: readonly FormId[],
  record: VisitForms = {},
): MissingDictationItem[] {
  const isFilled = (formId: FormId, key: string) =>
    !isEmptyValue(dictation.draft[formId]?.values[key]) ||
    !isEmptyValue(record[formId]?.[key]);
  const isMissing = (ref: string) => {
    const dot = ref.indexOf(".");
    return !isFilled(ref.slice(0, dot) as FormId, ref.slice(dot + 1));
  };

  const asked = new Set(dictation.questions.flatMap((q) => q.fields));
  const items = dictation.questions.flatMap((q) => {
    const refs = q.fields.filter(isMissing);
    return refs.length > 0 ? [missingItem(refs, q.question)] : [];
  });
  for (const formId of formIds) {
    if (!dictation.draft[formId]) continue;
    const form = FORMS[formId];
    const satisfied = new Set(
      (form.followUps ?? [])
        .filter((group) => group.anyOf.some((key) => isFilled(formId, key)))
        .flatMap((group) => group.anyOf),
    );
    for (const field of dictationFields(form)) {
      const pair = numberPairOf(form, field.key);
      if (pair && pair.keys[0] !== field.key) continue;
      if (satisfied.has(field.key)) continue;
      const refs = (pair?.keys ?? [field.key])
        .map((key) => `${formId}.${key}`)
        .filter((ref) => isMissing(ref) && !asked.has(ref));
      if (refs.length > 0) items.push(missingItem(refs, null));
    }
  }
  return [
    ...items.filter((item) => item.required),
    ...items.filter((item) => !item.required),
  ];
}
