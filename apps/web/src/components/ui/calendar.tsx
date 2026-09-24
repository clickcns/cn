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
  "hover:bg-muted focus-visible:ring-ring/30 inline-flex size-10 items-center justify-center rounded-lg outline-none focus-visible:ring-4 aria-disabled:pointer-events-none aria-disabled:opacity-35";

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
        orientation === "down" ? "size-4 opacity-60" : "size-5",
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
        nav: "absolute inset-x-0 top-0 flex h-11 items-center justify-between",
        button_previous: navButton,
        button_next: navButton,
        month_caption: "flex h-11 items-center justify-center px-11",
        dropdowns: "flex items-center gap-1.5",
        dropdown_root:
          "border-input bg-card has-focus:border-primary has-focus:ring-ring/15 relative rounded-lg border has-focus:ring-4",
        dropdown: "absolute inset-0 cursor-pointer opacity-0",
        caption_label:
          "flex h-10 items-center gap-1 pr-2 pl-3 text-base font-semibold whitespace-nowrap",
        month_grid: "border-collapse",
        weekday: "text-muted-foreground size-11 text-sm font-medium",
        day: "p-0 text-center",
        day_button:
          "hover:bg-muted focus-visible:ring-ring/30 size-11 rounded-lg text-base tabular-nums outline-none focus-visible:ring-4",
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
