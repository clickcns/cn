import {
  FORMS,
  formFields,
  isEmptyValue,
  type FormData,
  type FormId,
} from "@repo/shared-types";
import {
  sameFieldState,
  sameFieldValue,
  toFieldState,
  type FieldState,
  type FormState,
  type OptionState,
} from "@/features/forms/lib/form-state";

export interface MergedFormValues {
  forms: Record<string, FormState>;
  /** 이미 입력한 다른 값이 바뀌는 칸("서식 · 칸") — 바꾸기 전에 확인한다 */
  overwritten: string[];
  /** 실제로 값이 바뀐 칸(서식 순서) */
  changed: { formId: FormId; key: string }[];
}

/**
 * 여러 개 고르는 칸을 합친다: 이미 고른 항목은 두고 새 항목을 더한다.
 * 같은 항목이면 새 값에 있는 괄호 내용·시간·메모로 채운다.
 */
function unionOptions(before: OptionState[], incoming: OptionState[]) {
  let changedExisting = false;
  const items = before.map((item) => {
    const update = incoming.find((candidate) => candidate.value === item.value);
    if (!update) return item;
    const merged: OptionState = {
      value: item.value,
      detail: update.detail || item.detail,
      minutes: update.minutes || item.minutes,
      note: update.note || item.note,
    };
    if (
      (item.detail && item.detail !== merged.detail) ||
      (item.minutes && item.minutes !== merged.minutes) ||
      (item.note && item.note !== merged.note)
    ) {
      changedExisting = true;
    }
    return merged;
  });
  for (const item of incoming) {
    if (!before.some((candidate) => candidate.value === item.value)) {
      items.push(item);
    }
  }
  return { items, changedExisting };
}

/**
 * 서식 값을 입력 폼 상태에 합친다. 들어온 값이 있는 칸만 바꾸고 나머지는 그대로 둔다(빈 값으로 지우지 않는다).
 * 여러 개 고르는 칸은 union(음성 초안: 이미 고른 항목에 더한다) 또는 replace(지난 기록: 그 기록대로 바꾼다).
 * 이미 입력한 다른 값을 바꾸게 되면 overwritten 에 알려 준다(덮어쓰기 전에 확인).
 */
export function mergeFormValues(
  current: Record<string, FormState>,
  incoming: Partial<Record<FormId, FormData>>,
  formIds: readonly FormId[],
  { multi }: { multi: "union" | "replace" },
): MergedFormValues {
  const overwritten: string[] = [];
  const changed: MergedFormValues["changed"] = [];
  const forms = { ...current };

  for (const formId of formIds) {
    const values = incoming[formId];
    if (!values) continue;
    const form = FORMS[formId];
    const next: FormState = { ...current[formId] };

    for (const field of formFields(form)) {
      if (!(field.key in values) || isEmptyValue(values[field.key])) continue;
      const incomingState = toFieldState(field, values[field.key]);
      const before = next[field.key];
      const label = `${form.shortTitle} · ${field.label}`;

      let nextState: FieldState;
      let overwrites: boolean;
      if (field.type === "multi") {
        const beforeItems = (before as OptionState[] | null | undefined) ?? [];
        const incomingItems = incomingState as OptionState[];
        const union =
          multi === "union" ? unionOptions(beforeItems, incomingItems) : null;
        nextState = union?.items ?? incomingItems;
        if (sameFieldValue(beforeItems, nextState)) continue;
        overwrites = union ? union.changedExisting : beforeItems.length > 0;
      } else {
        nextState = incomingState;
        if (sameFieldState(before, nextState)) continue;
        overwrites = !isEmptyValue(before);
      }
      if (overwrites) overwritten.push(label);
      changed.push({ formId, key: field.key });
      next[field.key] = nextState;
    }
    forms[formId] = next;
  }

  return { forms, overwritten, changed };
}
