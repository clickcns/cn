import type { FormData, FormId, RecordDraft } from "@repo/shared-types";
import {
  mergeFormValues,
  type MergedFormValues,
} from "@/features/forms/lib/merge-form-values";
import type { FormState } from "@/features/forms/lib/form-state";

/**
 * 초안을 서식 폼 상태에 합친다. 초안에 있는 칸만 바꾸고 나머지는 그대로 둔다.
 * 여러 개 고르는 칸은 이미 고른 항목에 초안 항목을 더한다.
 * 이미 입력한 다른 값을 바꾸게 되면 overwritten에 알려 준다(덮어쓰기 전에 확인).
 */
export function mergeDraft(
  current: Record<string, FormState>,
  draft: RecordDraft,
  formIds: readonly FormId[],
): MergedFormValues {
  const values: Partial<Record<FormId, FormData>> = {};
  for (const formId of formIds) {
    const formDraft = draft[formId];
    if (formDraft) values[formId] = formDraft.values;
  }
  return mergeFormValues(current, values, formIds, { multi: "union" });
}
