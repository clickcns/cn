import { FORMS, type FormId, type FormRule } from "@repo/shared-types";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

/**
 * 방문에서 쓸 서식 고르기(방문 추가·기록 화면). 필수 서식은 켜진 채로 두고 선택 서식만 켜고 끈다.
 * selected는 resolveFormIds로 만든 목록이고, onToggle은 선택 서식 하나를 켜고 끈다.
 */
export function FormChoiceList({
  rules,
  selected,
  onToggle,
  disabled,
  idPrefix,
}: {
  rules: readonly FormRule[];
  selected: readonly FormId[];
  onToggle: (formId: FormId, on: boolean) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rules.map((rule) => {
        const form = FORMS[rule.formId];
        const id = `${idPrefix}-${rule.formId}`;
        return (
          <li
            key={rule.formId}
            className="bg-card flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3"
          >
            <label
              htmlFor={rule.required ? undefined : id}
              className="flex min-w-0 flex-1 flex-col"
            >
              <span className="text-muted-foreground text-sm font-semibold">
                {form.code}
              </span>
              <span className="font-bold">{form.shortTitle}</span>
              {rule.when && (
                <span className="text-muted-foreground text-sm">
                  {rule.when}
                </span>
              )}
            </label>
            {rule.required ? (
              <Badge>필수</Badge>
            ) : (
              <Switch
                id={id}
                checked={selected.includes(rule.formId)}
                disabled={disabled}
                onCheckedChange={(on) => onToggle(rule.formId, on)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
