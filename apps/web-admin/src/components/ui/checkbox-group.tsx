import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface CheckboxOption<T extends string> {
  value: T;
  label: ReactNode;
  /** 항목 옆의 작은 안내(예: "필수", "장기요양등급 필요") */
  note?: ReactNode;
  disabled?: boolean;
}

/** 여러 개 고르는 체크박스 묶음. value는 고른 항목들이고, 바꿀 때마다 새 목록으로 onChange를 부른다. */
export function CheckboxGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** 묶음의 접근성 이름 */
  label: string;
  options: readonly CheckboxOption<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid gap-2", className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <Checkbox
            checked={value.includes(option.value)}
            disabled={option.disabled}
            onCheckedChange={(next) =>
              onChange(
                next === true
                  ? [...value, option.value]
                  : value.filter((v) => v !== option.value),
              )
            }
          />
          <span>{option.label}</span>
          {option.note && (
            <span className="text-muted-foreground text-xs">{option.note}</span>
          )}
        </label>
      ))}
    </div>
  );
}
