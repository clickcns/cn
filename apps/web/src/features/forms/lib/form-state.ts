import {
  formFields,
  type FieldDef,
  type FieldValue,
  type FormData,
  type FormDef,
  type SelectedOption,
} from "@repo/shared-types";

/*
 * 서식 값 ↔ 입력 폼 상태. 폼은 입력 중인 글자를 그대로 들고 있도록 숫자도 문자열로 다룬다.
 * 저장할 때 숫자로 바꾸고, 검사는 SaveVisitRecordSchema(서식 정의)가 한다.
 */

export interface OptionState {
  value: string;
  /** 괄호 안 내용(글 또는 choice 값) */
  detail: string;
  minutes: string;
  note: string;
}

export type FieldState = string | OptionState | OptionState[] | null;
export type FormState = Record<string, FieldState>;

const text = (value: number | string | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export function toOptionState(selected: SelectedOption): OptionState {
  return {
    value: selected.value,
    detail: selected.detail ?? "",
    minutes: text(selected.minutes),
    note: selected.note ?? "",
  };
}

export function toFieldState(
  field: FieldDef,
  value: FieldValue | undefined,
): FieldState {
  switch (field.type) {
    case "single":
      return value ? toOptionState(value as SelectedOption) : null;
    case "multi":
      return ((value as SelectedOption[] | undefined) ?? []).map(toOptionState);
    case "number":
    case "text":
      return text(value as number | string | null | undefined);
  }
}

export function toFormState(
  form: FormDef,
  data: FormData | undefined,
): FormState {
  return Object.fromEntries(
    formFields(form).map((field) => [
      field.key,
      toFieldState(field, data?.[field.key]),
    ]),
  );
}

/** 빈 칸은 null. 숫자가 아니면 NaN을 그대로 넘겨 스키마가 한국어 오류를 내게 한다. */
function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(",", ".").replace("−", "-");
  return trimmed === "" ? null : Number(trimmed);
}

function fromOptionState(state: OptionState): SelectedOption {
  return {
    value: state.value,
    detail: state.detail.trim() || null,
    minutes: parseNumber(state.minutes),
    note: state.note.trim() || null,
  };
}

export function fromFormState(form: FormDef, state: FormState): FormData {
  const data: FormData = {};
  for (const field of formFields(form)) {
    const value = state[field.key];
    switch (field.type) {
      case "single":
        data[field.key] = value ? fromOptionState(value as OptionState) : null;
        break;
      case "multi":
        data[field.key] = ((value as OptionState[] | null) ?? []).map(
          fromOptionState,
        );
        break;
      case "number":
        data[field.key] = parseNumber((value as string | null) ?? "");
        break;
      case "text":
        data[field.key] = (value as string | null) ?? "";
        break;
    }
  }
  return data;
}

export function sameFieldState(
  a: FieldState | undefined,
  b: FieldState | undefined,
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
