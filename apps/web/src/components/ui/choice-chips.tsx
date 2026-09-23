import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipOption {
  value: string;
  label: string;
}

const chipClass =
  "inline-flex min-h-12 items-center gap-1.5 rounded-xl border px-4 py-2 text-left text-base font-medium transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/30";
const chipOff = "border-input bg-card text-foreground hover:bg-muted";
const chipOn =
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90";

/**
 * 하나 고르기(라디오). 고른 칩을 다시 누르면 선택을 지운다(비워 둘 수 있는 칸).
 */
export function RadioChips({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : option.value)}
            className={cn(chipClass, selected ? chipOn : chipOff)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** 여러 개 고르기(체크). */
export function CheckChips({
  options,
  values,
  onToggle,
  label,
}: {
  options: readonly ChipOption[];
  values: readonly string[];
  onToggle: (value: string, selected: boolean) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(option.value, !selected)}
            className={cn(chipClass, selected ? chipOn : chipOff)}
          >
            {selected && <Check className="size-4 shrink-0" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
