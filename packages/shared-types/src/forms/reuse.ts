import {
  findOption,
  formFields,
  isEmptyValue,
  MINUTES_FIELD,
  normalizeOptionDetail,
  numberPairOf,
  numberSchema,
  OPTION_NOTE_MAX_LENGTH,
  type ChoiceFieldDef,
  type FieldDef,
  type FieldValue,
  type FormData,
  type FormDef,
  type SelectedOption,
} from "./engine.js";

/*
 * 지난 기록 다시 쓰기(지난 기록 불러오기·지난 값 모두 적용·칸마다 지난 값 표시). 저장된 값은 그때의 서식 정의로 검사한 값이므로, 지침이
 * 개정돼 칸·선택지가 바뀌었으면 지금 정의에 없는 것은 버린다. 방문마다 새로 정하는 칸(visitSpecific)과
 * 제공 시간(분)은 지난 기록에서 불러오지 않는다.
 */

/** 고른 항목 하나를 지금 정의에 맞게: 없는 항목이면 null, 괄호 내용·시간·메모는 지금 항목에 맞는 것만. */
function sanitizeOption(
  field: ChoiceFieldDef,
  raw: unknown,
): SelectedOption | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { value, detail, minutes, note } = raw as Record<string, unknown>;
  if (typeof value !== "string") return null;
  const option = findOption(field, value);
  if (!option) return null;
  const selected: SelectedOption = { value };
  const normalized = normalizeOptionDetail(field, value, detail);
  if (normalized) selected.detail = normalized;
  if (option.detail?.kind === "minutes") {
    if (numberSchema(MINUTES_FIELD).safeParse(minutes).success) {
      selected.minutes = minutes as number;
    }
    const text = typeof note === "string" ? note.trim() : "";
    if (option.detail.note && text) {
      selected.note = text.slice(0, OPTION_NOTE_MAX_LENGTH);
    }
  }
  return selected;
}

/** 저장된 칸 값 하나를 지금 서식 정의에 맞게 고른다. 맞지 않거나 비어 있으면 null. */
export function sanitizeFieldValue(field: FieldDef, raw: unknown): FieldValue {
  switch (field.type) {
    case "single":
      return sanitizeOption(field, raw);
    case "multi": {
      if (!Array.isArray(raw)) return null;
      const seen = new Set<string>();
      const items = raw.flatMap((item) => {
        const selected = sanitizeOption(field, item);
        if (!selected || seen.has(selected.value)) return [];
        seen.add(selected.value);
        return [selected];
      });
      return items.length > 0 ? items : null;
    }
    case "number":
      return numberSchema(field).safeParse(raw).success
        ? (raw as number)
        : null;
    case "text":
      return typeof raw === "string" && raw.trim() !== "" ? raw : null;
  }
}

/** 제공 시간(분)은 그 방문의 기록이라 다시 쓰지 않는다(메모는 남긴다). */
function withoutMinutes(selected: SelectedOption): SelectedOption {
  const copy = { ...selected };
  delete copy.minutes;
  return copy;
}

/**
 * 지난 칸 값을 이번 기록에 채울 값으로. 방문마다 새로 정하는 칸(visitSpecific)이거나 지금 정의에 맞지 않으면
 * null, 고른 항목의 제공 시간은 뺀다.
 */
export function reusableFieldValue(field: FieldDef, raw: unknown): FieldValue {
  if (field.visitSpecific) return null;
  const value = sanitizeFieldValue(field, raw);
  if (field.type === "single" && value) {
    return withoutMinutes(value as SelectedOption);
  }
  if (field.type === "multi" && value) {
    return (value as SelectedOption[]).map(withoutMinutes);
  }
  return value;
}

/** 지난 서식 값에서 이 칸들(서식 전체 또는 구분 하나)의 다시 쓸 값. 값이 있는 칸만 남긴다. */
export function reusableValues(
  fields: readonly FieldDef[],
  data: Readonly<Record<string, unknown>> | undefined,
): FormData {
  const values: FormData = {};
  for (const field of fields) {
    const value = reusableFieldValue(field, data?.[field.key]);
    if (!isEmptyValue(value)) values[field.key] = value;
  }
  return values;
}

/** 지난 기록에서 불러오지 않는 것(안내 문구): 방문마다 새로 정하는 칸 이름(숫자 짝은 짝 이름)과 제공 시간. */
export function notReusedLabels(form: FormDef): string[] {
  const labels = new Set<string>();
  for (const field of formFields(form)) {
    if (field.visitSpecific) {
      labels.add(numberPairOf(form, field.key)?.label ?? field.label);
    }
  }
  const hasMinutes = formFields(form).some(
    (field) =>
      (field.type === "single" || field.type === "multi") &&
      field.options.some((option) => option.detail?.kind === "minutes"),
  );
  if (hasMinutes) labels.add(MINUTES_FIELD.label);
  return [...labels];
}
