import { z } from "zod";
import { optionalText } from "../schema.js";
import { withParticle } from "../text.js";

/*
 * 서식 엔진. 서식마다 칸(종류·선택지·라벨)을 한 번 정의하면
 * 저장 검사 스키마, 입력 화면, 구술 초안 요청·검사, 표시 문구가 모두 이 정의에서 나온다.
 * 지침이 개정되면 서식 정의만 고친다.
 */

export interface ChoiceOption {
  value: string;
  label: string;
}

/**
 * 선택 항목에 딸린 추가 입력.
 * - text: "기타( )", "욕창관리(부위)", "검사 시행( )"처럼 괄호 안 내용
 * - choice: "자원연계 제공(○정보제공 ○기관연계)"처럼 괄호 안 선택
 * - minutes: 항목별 제공 시간(분)과 메모(장기요양 방문간호)
 */
export type OptionDetail =
  | { kind: "text"; label: string }
  | { kind: "choice"; label: string; options: readonly ChoiceOption[] }
  | { kind: "minutes"; note: boolean };

export interface FieldOption {
  value: string;
  label: string;
  detail?: OptionDetail;
  /** 구술 초안(LLM)에 주는 설명: 어떤 말을 이 항목으로 볼지 */
  hint?: string;
}

interface FieldCommon {
  key: string;
  label: string;
  /** 구술에서 채우는 칸. false면 사람이 고르거나 지난 기록에서 가져온다. */
  dictation: boolean;
  /** 같은 수급자의 지난 서식 값을 기본값으로 쓴다(자주 바뀌지 않는 칸). */
  carryOver?: boolean;
  /** 구술 초안에서 비어 있으면 되묻는 질문. 같은 질문은 한 번만 묻는다. */
  question?: string;
  /** 구술 초안(LLM)에 주는 설명 */
  hint?: string;
  /** 화면에 보이는 도움말 */
  description?: string;
  /**
   * 확정 전에 반드시 채울 칸(제출할 곳의 필수 항목). 비어 있으면 확정하지 못한다.
   * 어느 칸인지는 협력 기관 확인에 따라 서식 정의에서만 켜고 끈다.
   */
  required?: boolean;
}

export interface SingleFieldDef extends FieldCommon {
  type: "single";
  options: readonly FieldOption[];
}

export interface MultiFieldDef extends FieldCommon {
  type: "multi";
  options: readonly FieldOption[];
}

export interface NumberFieldDef extends FieldCommon {
  type: "number";
  unit: string;
  min: number;
  max: number;
  /** 소수 자릿수. 0이면 정수만. */
  decimals: 0 | 1;
  /** 체중 증감처럼 음수(감소)를 쓰는 칸 */
  signed?: boolean;
}

export interface TextFieldDef extends FieldCommon {
  type: "text";
  maxLength: number;
  multiline: boolean;
  /** 넘으면 경고만 하는 글자 수와 그 제한이 있는 곳(예: 공단 앱 특이사항 칸 200자) */
  softLimit?: { length: number; target: string };
}

export type FieldDef =
  SingleFieldDef | MultiFieldDef | NumberFieldDef | TextFieldDef;
export type ChoiceFieldDef = SingleFieldDef | MultiFieldDef;

/** "앞 칸 / 뒤 칸" 한 줄로 적는 숫자 두 칸(예: 혈압 수축기/이완기). */
export interface NumberPair {
  label: string;
  keys: readonly [string, string];
  /** 앞 칸이 뒤 칸보다 커야 한다. 구술 초안이 어기면 둘 다 비운다. */
  firstGreater: boolean;
}

export interface FormSection {
  title: string;
  fields: readonly FieldDef[];
}

export interface FormDef {
  id: string;
  /** 예: "별지 제4호" */
  code: string;
  title: string;
  /** 탭·목록에 쓰는 짧은 이름 */
  shortTitle: string;
  /** 작성한 뒤 입력·제출하는 곳 */
  submitTo: string;
  sections: readonly FormSection[];
  /** 구술할 때 보여 주는 안내(순서 상관없음) */
  guide: readonly string[];
  /** 여러 칸이 모두 비었을 때만 묻는 질문(예: 건강관리·간호관리 중 하나라도) */
  followUps?: readonly { anyOf: readonly string[]; question: string }[];
  /** 한 줄로 적는 숫자 두 칸. 두 칸은 같은 구분(섹션)에 있어야 한다. */
  numberPairs?: readonly NumberPair[];
  /** 음성인식 힌트 용어(Whisper initial_prompt는 길면 잘리므로 몇 개만) */
  sttTerms: readonly string[];
}

/** 고른 항목 하나. detail은 괄호 안 내용(글 또는 choice 값). */
export interface SelectedOption {
  value: string;
  detail?: string | null;
  minutes?: number | null;
  note?: string | null;
}

export type FieldValue =
  SelectedOption | SelectedOption[] | number | string | null;

/** 서식 한 장의 값. 키는 칸 키다. */
export type FormData = Record<string, FieldValue>;

export function formFields(form: FormDef): FieldDef[] {
  return form.sections.flatMap((section) => section.fields);
}

/** 확정 전에 채워야 하는데 비어 있는 칸(서식 순서대로). */
export function missingRequiredFields(
  form: FormDef,
  data: Readonly<Record<string, unknown>> | undefined,
): FieldDef[] {
  return formFields(form).filter(
    (field) => field.required && isEmptyValue(data?.[field.key]),
  );
}

/** 구술에서 채우는 칸 */
export function dictationFields(form: FormDef): FieldDef[] {
  return formFields(form).filter((field) => field.dictation);
}

export function findOption(
  field: ChoiceFieldDef,
  value: string,
): FieldOption | undefined {
  return field.options.find((option) => option.value === value);
}

/* ---------- 저장 검사 스키마 ---------- */

/** 고른 항목의 괄호 안 내용·메모 최대 글자 수 */
export const OPTION_DETAIL_MAX_LENGTH = 200;
export const OPTION_NOTE_MAX_LENGTH = 500;

/** 항목별 제공 시간(분) 칸. 저장 검사와 구술 초안 검사가 같은 범위를 쓴다. */
export const MINUTES_FIELD: NumberFieldDef = {
  key: "minutes",
  label: "제공 시간",
  type: "number",
  unit: "분",
  min: 0,
  max: 600,
  decimals: 0,
  dictation: true,
};

export function optionValues(field: ChoiceFieldDef) {
  return field.options.map((option) => option.value) as [string, ...string[]];
}

function selectedOptionSchema(field: ChoiceFieldDef) {
  return z.object({
    value: z.enum(
      optionValues(field),
      `${field.label}: 선택 항목이 올바르지 않습니다`,
    ),
    // 빈 입력("", 공백만)은 null로 바꾼다(shared-types 공통 규칙).
    detail: optionalText(
      OPTION_DETAIL_MAX_LENGTH,
      `${field.label}: 괄호 안 내용`,
    ),
    minutes: z
      .int(`${field.label}: 제공 시간은 분 단위 정수로 입력해 주세요`)
      .min(
        MINUTES_FIELD.min,
        `${field.label}: 제공 시간은 ${MINUTES_FIELD.min}분 이상이어야 합니다`,
      )
      .max(
        MINUTES_FIELD.max,
        `${field.label}: 제공 시간은 ${MINUTES_FIELD.max}분 이하여야 합니다`,
      )
      .nullish(),
    note: optionalText(OPTION_NOTE_MAX_LENGTH, `${field.label}: 메모`),
  });
}

/** 소수 첫째 자리까지인지. 36.6 * 10 같은 부동소수 오차는 허용한다. */
const hasOneDecimal = (value: number) =>
  Math.abs(Math.round(value * 10) - value * 10) < 1e-6;

/** 숫자 칸 하나의 값 검사(구술 초안 검사에서 범위를 확인할 때도 쓴다). */
export function numberSchema(field: NumberFieldDef) {
  const label = withParticle(field.label, "은/는");
  const range = `${label} ${field.min}~${field.max} 사이여야 합니다`;
  if (field.decimals === 0) {
    return z
      .int(`${label} 정수로 입력해 주세요`)
      .min(field.min, range)
      .max(field.max, range);
  }
  return z
    .number(`${label} 숫자로 입력해 주세요`)
    .min(field.min, range)
    .max(field.max, range)
    .refine(hasOneDecimal, `${label} 소수 첫째 자리까지 입력해 주세요`);
}

function fieldSchema(field: FieldDef): z.ZodType {
  switch (field.type) {
    case "single":
      return selectedOptionSchema(field).nullable().default(null);
    case "multi":
      return z
        .array(selectedOptionSchema(field))
        .refine(
          (items) =>
            new Set(items.map((item) => item.value)).size === items.length,
          `${field.label}: 같은 항목이 중복되었습니다`,
        )
        .default([]);
    case "number":
      return numberSchema(field).nullable().default(null);
    case "text":
      return z
        .string()
        .trim()
        .max(
          field.maxLength,
          `${withParticle(field.label, "은/는")} ${field.maxLength}자 이하로 입력해 주세요`,
        )
        .default("");
  }
}

function buildFormDataSchema(form: FormDef): z.ZodType<FormData> {
  const shape: Record<string, z.ZodType> = {};
  for (const field of formFields(form)) shape[field.key] = fieldSchema(field);
  // 칸마다 스키마가 칸 종류에 맞는 값(FieldValue)을 내므로 서식 값 모양으로 본다.
  return z.object(shape) as unknown as z.ZodType<FormData>;
}

// 스키마를 만들고 처음 검사할 때 드는 비용(ms 단위)이 저장·확정마다 반복되지 않게 서식마다 한 번만 만든다.
const formDataSchemas = new WeakMap<FormDef, z.ZodType<FormData>>();

/** 서식 값 검사 스키마. 빠진 칸은 빈 값으로 채우고, 모르는 칸은 버린다. */
export function formDataSchema(form: FormDef): z.ZodType<FormData> {
  let schema = formDataSchemas.get(form);
  if (!schema) {
    schema = buildFormDataSchema(form);
    formDataSchemas.set(form, schema);
  }
  return schema;
}

/** 빈 칸: 값 없음, 빈 배열, 공백뿐인 글. 서식 값과 입력 폼 상태에 모두 쓴다. */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/* ---------- 표시 ---------- */

function formatNumber(field: NumberFieldDef, value: number): string {
  if (field.signed) {
    if (value === 0) return `변화 없음`;
    return `${value > 0 ? "증" : "감"} ${Math.abs(value)} ${field.unit}`;
  }
  return `${value} ${field.unit}`;
}

/** 고른 항목 하나를 글로: "기타(야간 흡인)", "욕창 관리 15분" */
export function formatSelectedOption(
  field: ChoiceFieldDef,
  selected: SelectedOption,
): string {
  const option = findOption(field, selected.value);
  if (!option) return selected.value;
  const parts = [option.label];
  if (selected.detail) {
    const detail =
      option.detail?.kind === "choice"
        ? (option.detail.options.find((c) => c.value === selected.detail)
            ?.label ?? selected.detail)
        : selected.detail;
    parts[0] = `${option.label}(${detail})`;
  }
  if (selected.minutes != null) parts.push(`${selected.minutes}분`);
  if (selected.note) parts.push(`— ${selected.note}`);
  return parts.join(" ");
}

/** 칸 값을 한 줄 글로. 비어 있으면 "". */
export function formatFieldValue(
  field: FieldDef,
  value: FieldValue | undefined,
): string {
  if (isEmptyValue(value)) return "";
  switch (field.type) {
    case "single":
      return formatSelectedOption(field, value as SelectedOption);
    case "multi":
      return (value as SelectedOption[])
        .map((selected) => formatSelectedOption(field, selected))
        .join(", ");
    case "number":
      return formatNumber(field, value as number);
    case "text":
      return (value as string).trim();
  }
}
