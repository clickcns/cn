import {
  dictationFields,
  evidenceKey,
  findOption,
  formFields,
  FORMS,
  isEmptyValue,
  MINUTES_FIELD,
  numberSchema,
  OPTION_DETAIL_MAX_LENGTH,
  OPTION_NOTE_MAX_LENGTH,
  withParticle,
  type ChoiceFieldDef,
  type DictationSentence,
  type DraftIssue,
  type FieldEvidence,
  type FollowUpQuestion,
  type FormData,
  type FormDraft,
  type FormId,
  type NumberFieldDef,
  type RecordDraft,
  type SelectedOption,
} from "@repo/shared-types";
import type { z } from "zod";
import type { LlmDraft, NumberAnswer } from "./draft-prompt.js";
import { numbersInText, parseSpokenNumber } from "./spoken-number.js";

/*
 * LLM 초안 자동 검사(서식 공통). 의료 기록에서 가장 위험한 실수는 틀린 숫자이므로,
 * 숫자는 근거 문장에 그 표기가 실제로 있고 값이 같을 때만 남긴다. 아니면 비우고 이유를 남긴다.
 * 근거 문장이 없는 값도 뺀다. 비운 값은 빠진 칸이 되어 되묻기 질문으로 이어진다.
 */

interface TextAnswer {
  text: string;
  evidence: string[];
}
interface SingleAnswer {
  value: string | null;
  detail?: string | null;
  evidence: string[];
}
interface MultiItemAnswer {
  value: string;
  detail?: string | null;
  minutes?: NumberAnswer;
  note?: string | null;
  evidence: string[];
}

const compact = (text: string) => text.replace(/\s+/g, "");

/** 스키마로 값 범위를 확인한다. 통과하면 null, 아니면 스키마의 한국어 문구. */
function rangeMessage(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success
    ? null
    : (result.error.issues[0]?.message ?? "범위를 벗어났습니다");
}

class DraftChecker {
  readonly issues: DraftIssue[] = [];
  private readonly sentences: Map<string, string>;
  /** 구술 전체에 나온 숫자. 자유 글의 숫자가 구술에 있는지 느슨하게 확인한다. */
  private readonly spokenNumbers: Set<number>;

  constructor(sentences: readonly DictationSentence[]) {
    this.sentences = new Map(sentences.map((s) => [s.id, s.text]));
    this.spokenNumbers = new Set(
      sentences.flatMap((s) => numbersInText(s.text)),
    );
  }

  issue(field: string, severity: DraftIssue["severity"], message: string) {
    this.issues.push({ field, severity, message });
  }

  /** 있는 문장 ID만, 중복 없이. */
  evidence(ids: readonly string[] | undefined): string[] {
    const valid = (ids ?? [])
      .map((id) => id.trim().toUpperCase())
      .filter((id) => this.sentences.has(id));
    return [...new Set(valid)];
  }

  /** 근거 문장 ID. 없으면 값을 빼고(removed) null. */
  requireEvidence(
    path: string,
    label: string,
    ids: readonly string[] | undefined,
    removed = "비웠습니다",
  ): string[] | null {
    const valid = this.evidence(ids);
    if (valid.length > 0) return valid;
    this.issue(path, "removed", `${label}: 근거 문장이 없어 ${removed}`);
    return null;
  }

  /**
   * 숫자 하나 검사: 근거 문장이 있고, 그 문장에 quote가 있고, quote를 읽은 값이 value와 같고,
   * 칸 범위 안이어야 남긴다. 증감 칸(signed)은 quote가 크기만 나타내므로 절댓값으로 대조한다.
   */
  number(
    path: string,
    label: string,
    raw: NumberAnswer | undefined,
    field: NumberFieldDef,
  ): { value: number; ids: string[]; quote: string } | null {
    if (!raw || raw.value === null) return null;
    const remove = (reason: string) => {
      this.issue(path, "removed", `${label}: ${reason}`);
      return null;
    };

    const ids = this.evidence(raw.evidence);
    if (ids.length === 0) return remove("근거 문장이 없어 비웠습니다");

    const quote = raw.quote?.trim() ?? "";
    const quoted =
      quote !== "" &&
      ids.some((id) =>
        compact(this.sentences.get(id)!).includes(compact(quote)),
      );
    if (!quoted) {
      return remove(
        `근거 문장에서 "${quote || raw.value}"을(를) 찾지 못해 비웠습니다`,
      );
    }

    const spoken = parseSpokenNumber(quote);
    const expected = field.signed ? Math.abs(raw.value) : raw.value;
    if (spoken === null || Math.abs(spoken - expected) > 1e-9) {
      return remove(`구술한 숫자("${quote}")와 달라 비웠습니다`);
    }

    const outOfRange = rangeMessage(numberSchema(field), raw.value);
    if (outOfRange) return remove(`${outOfRange}. 비웠습니다`);

    return { value: raw.value, ids, quote };
  }

  /** 자유 글의 숫자가 구술에 없으면 확인 요청만 남긴다(글은 그대로 둔다). */
  textNumbers(path: string, label: string, text: string): void {
    const unknown = [
      ...new Set(
        [...text.matchAll(/\d+(?:\.\d+)?/g)]
          .map((match) => Number(match[0]))
          .filter((value) => !this.spokenNumbers.has(value)),
      ),
    ];
    if (unknown.length > 0) {
      this.issue(
        path,
        "check",
        `${label}: 구술에 없는 숫자(${unknown.join(", ")})가 있습니다. 확인해 주세요`,
      );
    }
  }
}

/** 괄호 안 내용: 글 칸은 다듬어서, 선택 칸은 선택지 안의 값만. 괄호가 없는 항목은 버린다. */
function normalizeDetail(
  field: ChoiceFieldDef,
  value: string,
  detail: string | null | undefined,
): string | null {
  const option = findOption(field, value);
  const text = detail?.trim();
  if (!option?.detail || !text) return null;
  if (option.detail.kind === "text") {
    return text.slice(0, OPTION_DETAIL_MAX_LENGTH);
  }
  if (option.detail.kind === "choice") {
    return option.detail.options.some((choice) => choice.value === text)
      ? text
      : null;
  }
  return null;
}

function checkForm(
  checker: DraftChecker,
  formId: FormId,
  raw: Record<string, unknown>,
): FormDraft {
  const form = FORMS[formId];
  const values: FormData = {};
  const evidence: Record<string, FieldEvidence> = {};

  for (const field of dictationFields(form)) {
    const path = `${formId}.${field.key}`;
    const answer = raw[field.key];

    switch (field.type) {
      case "number": {
        const checked = checker.number(
          path,
          field.label,
          answer as NumberAnswer | undefined,
          field,
        );
        if (checked) {
          values[field.key] = checked.value;
          evidence[field.key] = { ids: checked.ids, quotes: [checked.quote] };
        }
        break;
      }
      case "text": {
        const text = (answer as TextAnswer | undefined)?.text.trim() ?? "";
        if (!text) break;
        const ids = checker.requireEvidence(
          path,
          field.label,
          (answer as TextAnswer).evidence,
        );
        if (!ids) break;
        checker.textNumbers(path, field.label, text);
        values[field.key] = text.slice(0, field.maxLength);
        evidence[field.key] = { ids, quotes: [] };
        break;
      }
      case "single": {
        const single = answer as SingleAnswer | undefined;
        // 선택지 코드는 응답 스키마가 강제하지만, 모르는 코드는 한 번 더 걸러 낸다.
        if (!single?.value || !findOption(field, single.value)) break;
        const ids = checker.requireEvidence(path, field.label, single.evidence);
        if (!ids) break;
        values[field.key] = {
          value: single.value,
          detail: normalizeDetail(field, single.value, single.detail),
        };
        evidence[field.key] = { ids, quotes: [] };
        break;
      }
      case "multi": {
        const items = (answer as { items?: MultiItemAnswer[] } | undefined)
          ?.items;
        const selected: SelectedOption[] = [];
        for (const item of items ?? []) {
          // 같은 항목이 두 번 오면 앞의 것만 쓴다. 모르는 코드는 버린다.
          const option = findOption(field, item.value);
          if (!option || selected.some((kept) => kept.value === item.value)) {
            continue;
          }
          const label = option.label;
          const ids = checker.requireEvidence(
            `${path}.${item.value}`,
            `${field.label} ${label}`,
            item.evidence,
            "뺐습니다",
          );
          if (!ids) continue;
          const minutes = checker.number(
            `${path}.${item.value}.minutes`,
            `${label} 시간`,
            item.minutes,
            MINUTES_FIELD,
          );
          const note = item.note?.trim() || null;
          if (note)
            checker.textNumbers(
              `${path}.${item.value}.note`,
              `${label} 메모`,
              note,
            );

          const entry: SelectedOption = {
            value: item.value,
            detail: normalizeDetail(field, item.value, item.detail),
          };
          if (item.minutes !== undefined)
            entry.minutes = minutes?.value ?? null;
          if (item.note !== undefined) {
            entry.note = note?.slice(0, OPTION_NOTE_MAX_LENGTH) ?? null;
          }
          selected.push(entry);
          evidence[evidenceKey(field.key, item.value)] = {
            ids: [...new Set([...ids, ...(minutes?.ids ?? [])])],
            quotes: minutes ? [minutes.quote] : [],
          };
        }
        if (selected.length > 0) values[field.key] = selected;
        break;
      }
    }
  }

  // 앞 칸이 커야 하는 짝(혈압 수축기/이완기)이 뒤집혔으면 둘 중 하나를 잘못 들은 것이다.
  for (const pair of form.numberPairs ?? []) {
    if (!pair.firstGreater) continue;
    const [firstKey, secondKey] = pair.keys;
    const first = values[firstKey];
    const second = values[secondKey];
    if (typeof first !== "number" || typeof second !== "number") continue;
    if (first > second) continue;
    const [firstLabel, secondLabel] = pair.keys.map(
      (key) => formFields(form).find((field) => field.key === key)?.label,
    );
    checker.issue(
      `${formId}.${firstKey}`,
      "removed",
      `${pair.label} ${first}/${second}: ${withParticle(firstLabel ?? firstKey, "이/가")} ${secondLabel ?? secondKey}보다 높지 않아 둘 다 비웠습니다`,
    );
    for (const key of pair.keys) {
      delete values[key];
      delete evidence[key];
    }
  }

  return { values, evidence };
}

export interface ValidatedDraft {
  draft: RecordDraft;
  issues: DraftIssue[];
}

export function validateDraft(
  formIds: readonly FormId[],
  raw: LlmDraft,
  sentences: readonly DictationSentence[],
): ValidatedDraft {
  const checker = new DraftChecker(sentences);
  const draft: RecordDraft = {};
  for (const formId of formIds) {
    draft[formId] = checkForm(checker, formId, raw[formId] ?? {});
  }
  // 두 서식에 같은 문제가 나와도 서식마다 남긴다(서식을 빼면 그 서식 것만 지운다).
  // 같은 문구를 한 번만 보여 주는 것은 화면이 한다.
  return { draft, issues: checker.issues };
}

/**
 * 빠진 칸 → 되물을 질문. 서식 정의의 question이 있는 칸이 비었으면 묻고,
 * 같은 질문(혈압 두 칸, 두 서식의 향후 계획 등)은 한 번만 묻는다.
 * 제공 시간(분)을 적는 항목은 고른 항목마다 시간이 없으면 따로 묻는다.
 */
export function followUpQuestions(
  formIds: readonly FormId[],
  draft: RecordDraft,
): FollowUpQuestion[] {
  const questions = new Map<string, string[]>();
  const ask = (question: string, field: string) => {
    questions.set(question, [...(questions.get(question) ?? []), field]);
  };

  for (const formId of formIds) {
    const form = FORMS[formId];
    const values = draft[formId]?.values ?? {};

    for (const followUp of form.followUps ?? []) {
      if (followUp.anyOf.every((key) => isEmptyValue(values[key]))) {
        for (const key of followUp.anyOf)
          ask(followUp.question, `${formId}.${key}`);
      }
    }

    for (const field of dictationFields(form)) {
      const value = values[field.key];
      if (field.question && isEmptyValue(value)) {
        ask(field.question, `${formId}.${field.key}`);
      }
      if (field.type === "multi" && Array.isArray(value)) {
        for (const item of value) {
          const option = findOption(field, item.value);
          if (option?.detail?.kind === "minutes" && item.minutes == null) {
            // 질문에는 괄호 설명을 빼고 쓴다: "영양 관리(비위관)" → "영양 관리는"
            const name = option.label.replace(/\s*\(.*\)$/, "");
            ask(
              `${withParticle(name, "은/는")} 몇 분 동안 하셨나요?`,
              `${formId}.${field.key}.${item.value}`,
            );
          }
        }
      }
    }
  }

  return [...questions].map(([question, fields]) => ({ question, fields }));
}
