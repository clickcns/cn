import {
  FORMS,
  formFields,
  isEmptyValue,
  type FormId,
  type RecordDraft,
} from "@repo/shared-types";
import {
  sameFieldState,
  toFieldState,
  type FormState,
  type OptionState,
} from "@/features/forms/lib/form-state";

export interface MergedDraft {
  forms: Record<string, FormState>;
  /** 이미 입력한 다른 값이 초안 값으로 바뀌는 칸("서식 · 칸") */
  overwritten: string[];
}

/**
 * 여러 개 고르는 칸은 합친다: 이미 고른 항목은 두고 초안 항목을 더한다.
 * 같은 항목이면 초안에 있는 괄호 내용·시간·메모로 채운다.
 */
function mergeOptions(before: OptionState[], incoming: OptionState[]) {
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
 * 초안을 서식 폼 상태에 합친다. 초안에 있는 칸만 바꾸고 나머지는 그대로 둔다.
 * 이미 입력한 다른 값을 바꾸게 되면 overwritten에 알려 준다(덮어쓰기 전에 확인).
 */
export function mergeDraft(
  current: Record<string, FormState>,
  draft: RecordDraft,
  formIds: readonly FormId[],
): MergedDraft {
  const overwritten: string[] = [];
  const forms = { ...current };

  for (const formId of formIds) {
    const values = draft[formId]?.values;
    if (!values) continue;
    const form = FORMS[formId];
    const next: FormState = { ...current[formId] };

    for (const field of formFields(form)) {
      if (!(field.key in values)) continue;
      const incoming = toFieldState(field, values[field.key]);
      const before = next[field.key];
      const label = `${form.shortTitle} · ${field.label}`;

      if (field.type === "multi") {
        const merged = mergeOptions(
          (before as OptionState[] | null | undefined) ?? [],
          incoming as OptionState[],
        );
        if (merged.changedExisting) overwritten.push(label);
        next[field.key] = merged.items;
      } else {
        if (!isEmptyValue(before) && !sameFieldState(before, incoming)) {
          overwritten.push(label);
        }
        next[field.key] = incoming;
      }
    }
    forms[formId] = next;
  }

  return { forms, overwritten };
}
