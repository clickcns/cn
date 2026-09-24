import type { FormData, FormId } from "./forms/index.js";

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
