import {
  DayPicker,
  type ChevronProps,
  type DayPickerProps,
} from "@daypicker/react";
import { ko } from "@daypicker/react/locale";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navButton =
  "hover:bg-muted focus-visible:ring-primary/30 inline-flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 aria-disabled:pointer-events-none aria-disabled:opacity-35";

function CalendarChevron({ orientation, className }: ChevronProps) {
  const Icon =
    orientation === "left"
      ? ChevronLeftIcon
      : orientation === "right"
        ? ChevronRightIcon
        : ChevronDownIcon;
  return (
    <Icon
      className={cn(
        orientation === "down" ? "size-3.5 opacity-60" : "size-4",
        className,
      )}
    />
  );
}

/**
 * 달력(react-day-picker). 한국어, 연·월 드롭다운으로 이동한다("2026년 10월").
 */
export function Calendar({ className, ...props }: DayPickerProps) {
  return (
    <DayPicker
      locale={ko}
      captionLayout="dropdown"
      showOutsideDays
      className={cn("w-fit", className)}
      formatters={{
        formatYearDropdown: (date) => `${date.getFullYear()}년`,
      }}
      classNames={{
        months: "relative flex flex-col",
        month: "flex flex-col gap-2",
        nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
        button_previous: navButton,
        button_next: navButton,
        month_caption: "flex h-9 items-center justify-center px-9",
        dropdowns: "flex items-center gap-1.5",
        dropdown_root:
          "border-input bg-card has-focus:border-primary has-focus:ring-primary/15 relative rounded-md border shadow-xs has-focus:ring-3",
        dropdown: "absolute inset-0 cursor-pointer opacity-0",
        caption_label:
          "flex h-8 items-center gap-1 pr-1.5 pl-2.5 text-sm font-medium whitespace-nowrap",
        month_grid: "border-collapse",
        weekday: "text-muted-foreground size-9 text-[12px] font-medium",
        day: "p-0 text-center",
        day_button:
          "hover:bg-muted focus-visible:ring-primary/30 size-9 rounded-md text-sm tabular-nums outline-none focus-visible:ring-2",
        today: "[&>button]:text-primary [&>button]:font-bold",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:font-semibold",
        outside: "[&>button]:text-muted-foreground/60",
        disabled: "[&>button]:pointer-events-none [&>button]:opacity-35",
        hidden: "invisible",
      }}
      components={{ Chevron: CalendarChevron }}
      {...props}
    />
  );
}
