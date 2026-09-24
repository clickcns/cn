import {
  formatDateTyping,
  formatKstDate,
  isIsoDate,
  normalizeDateTyping,
} from "@repo/shared-types";
import { CalendarIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DD" ↔ 달력의 Date(로컬 자정). 달력 칸의 날짜 자체만 주고받는다. */
const toDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day);
};
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const THIS_YEAR = new Date().getFullYear();

interface DateInputProps extends Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "min" | "max"
> {
  /** "YYYY-MM-DD" 또는 입력 중인 글자 */
  value: string;
  /** 칠 때마다 다듬은 글자로 부른다. 달력에서 고르면 "YYYY-MM-DD". */
  onChange: (value: string) => void;
  /** 고를 수 있는 날짜 범위(YYYY-MM-DD). 달력에서 벗어난 날은 흐리게 막는다. */
  min?: string;
  max?: string;
  containerClassName?: string;
}

/**
 * 날짜 입력: "2026-10-21" 꼴로 직접 치거나(숫자만 쳐도 하이픈이 들어간다),
 * 오른쪽 달력 버튼으로 연·월 드롭다운 달력에서 고른다.
 *
 * 부모가 온전한 날짜만 받는 경우(목록 필터)에는 치는 중인 글자를 이 칸이 들고 있다가,
 * 날짜가 아닌 채로 칸을 벗어나면 마지막 값으로 되돌린다.
 */
export function DateInput({
  value,
  onChange,
  onBlur,
  min,
  max,
  disabled,
  className,
  containerClassName,
  ...props
}: DateInputProps) {
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const [open, setOpen] = useState(false);
  // 부모 값이 바뀌면(달력 선택·초기화 등) 보이는 글자를 맞춘다.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }

  const emit = (next: string) => {
    setText(next);
    onChange(next);
  };

  const selected = isIsoDate(text) ? toDate(text) : undefined;
  const minDate = min && isIsoDate(min) ? toDate(min) : undefined;
  const maxDate = max && isIsoDate(max) ? toDate(max) : undefined;
  const today = formatKstDate();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative", containerClassName)}>
          <Input
            {...props}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="YYYY-MM-DD"
            maxLength={10}
            disabled={disabled}
            className={cn("pr-9", className)}
            value={text}
            onChange={(event) => emit(formatDateTyping(event.target.value))}
            onBlur={(event) => {
              const normalized = normalizeDateTyping(text);
              if (normalized !== text) emit(normalized);
              // 부모가 받지 않은 글자(불완전한 날짜·빈칸)는 마지막 값으로 되돌린다.
              // 빈칸을 받는 칸(선택 입력)은 value도 ""라 그대로 둔다.
              else if (text !== value && !isIsoDate(text)) {
                setText(value);
              }
              onBlur?.(event);
            }}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="달력에서 날짜 고르기"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-primary/30 absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <CalendarIcon className="size-4" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent>
        <Calendar
          mode="single"
          // 고른 날을 다시 눌러도 선택이 풀리지 않게 한다.
          required
          selected={selected}
          defaultMonth={selected ?? toDate(today)}
          startMonth={minDate ?? new Date(THIS_YEAR - 110, 0)}
          endMonth={maxDate ?? new Date(THIS_YEAR + 5, 11)}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          onSelect={(date) => {
            emit(toIso(date));
            setOpen(false);
          }}
        />
        <div className="mt-2 flex justify-end border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={
              (min !== undefined && today < min) ||
              (max !== undefined && today > max)
            }
            onClick={() => {
              emit(today);
              setOpen(false);
            }}
          >
            오늘
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
