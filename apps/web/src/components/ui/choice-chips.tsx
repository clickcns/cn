import { Check, History } from "lucide-react";
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
/** 지난 기록에서 골랐지만 지금은 고르지 않은 칩: 점선 테두리(지난번 자리) */
const chipPast =
  "border-dashed border-primary/60 bg-primary-soft/50 text-primary hover:bg-primary-soft";

/** 지난 기록에서 고른 칩의 표시(⟲). 화면 읽기 프로그램에는 "지난 기록"으로 읽힌다. */
function PastMark() {
  return (
    <>
      <History className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">(지난 기록)</span>
    </>
  );
}

/**
 * 하나 고르기(라디오). 고른 칩을 다시 누르면 선택을 지운다(비워 둘 수 있는 칸).
 * past(지난 기록에서 고른 값)를 주면 그 칩에 ⟲ 표시를 하고, 지금 고르지 않았으면 점선으로 남긴다.
 */
export function RadioChips({
  options,
  value,
  onChange,
  label,
  past,
}: {
  options: readonly ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  past?: readonly string[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        const isPast = past?.includes(option.value) ?? false;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : option.value)}
            className={cn(
              chipClass,
              selected ? chipOn : isPast ? chipPast : chipOff,
            )}
          >
            {isPast && <PastMark />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** 여러 개 고르기(체크). past 는 RadioChips 와 같다. */
export function CheckChips({
  options,
  values,
  onToggle,
  label,
  past,
}: {
  options: readonly ChipOption[];
  values: readonly string[];
  onToggle: (value: string, selected: boolean) => void;
  label: string;
  past?: readonly string[];
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = values.includes(option.value);
        const isPast = past?.includes(option.value) ?? false;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(option.value, !selected)}
            className={cn(
              chipClass,
              selected ? chipOn : isPast ? chipPast : chipOff,
            )}
          >
            {isPast ? (
              <PastMark />
            ) : (
              selected && <Check className="size-4 shrink-0" />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
