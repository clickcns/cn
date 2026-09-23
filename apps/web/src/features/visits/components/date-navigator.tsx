import { addKstDays } from "@repo/shared-types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateLabel, relativeDayLabel } from "@/lib/date";

interface DateNavigatorProps {
  date: string;
  today: string;
  onChange: (date: string) => void;
}

export function DateNavigator({ date, today, onChange }: DateNavigatorProps) {
  const relative = relativeDayLabel(date, today);

  return (
    <div className="border-border bg-card flex items-center gap-1 rounded-2xl border p-2 sm:gap-2 md:max-w-xl">
      <Button
        variant="ghost"
        size="icon"
        aria-label="이전 날"
        onClick={() => onChange(addKstDays(date, -1))}
      >
        <ChevronLeft className="size-7" />
      </Button>

      <div
        className="flex min-w-0 flex-1 flex-col items-center"
        aria-live="polite"
      >
        <span className="text-lg font-bold whitespace-nowrap tabular-nums sm:text-xl">
          {formatDateLabel(date)}
        </span>
        <span className="text-primary h-5 text-sm leading-5 font-semibold">
          {relative}
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label="다음 날"
        onClick={() => onChange(addKstDays(date, 1))}
      >
        <ChevronRight className="size-7" />
      </Button>

      <Button
        variant="soft"
        size="sm"
        onClick={() => onChange(today)}
        disabled={date === today}
      >
        오늘
      </Button>
    </div>
  );
}
