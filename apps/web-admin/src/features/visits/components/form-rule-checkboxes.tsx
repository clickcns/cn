import {
  formChoicesFor,
  formLabel,
  type FormChoices,
  type FormId,
  type FormRule,
} from "@repo/shared-types";
import { CheckboxGroup } from "@/components/ui/checkbox-group";

/**
 * 사업 × 직종 규칙의 작성 서식 체크박스(필수 서식은 끌 수 없다). 방문 등록 창과
 * 담당자 변경 창이 쓴다. 바꿀 때마다 규칙 전체의 켜고 끈 상태를 넘긴다.
 */
export function FormRuleCheckboxes({
  rules,
  value,
  onChange,
}: {
  rules: readonly FormRule[];
  value: readonly FormId[];
  onChange: (choices: FormChoices) => void;
}) {
  return (
    <CheckboxGroup
      label="작성 서식"
      options={rules.map((rule) => ({
        value: rule.formId,
        label: formLabel(rule.formId),
        note: rule.required ? "필수" : rule.when,
        disabled: rule.required,
      }))}
      value={[...value]}
      onChange={(next) => onChange(formChoicesFor(rules, next))}
    />
  );
}
