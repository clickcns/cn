import { CalendarDaysIcon, ListIcon } from "lucide-react";
import type { VisitView } from "@/features/visits/hooks/use-visit-view";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "list", label: "목록", icon: ListIcon },
  { value: "calendar", label: "달력", icon: CalendarDaysIcon },
] as const;

/** 방문 기록 보기 전환: 기간 목록(표) / 한 달 달력. */
export function VisitViewToggle({
  value,
  onChange,
}: {
  value: VisitView;
  onChange: (view: VisitView) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="보기"
      className="border-border bg-muted inline-flex h-9 rounded-md border p-0.5"
    >
      {OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              "focus-visible:ring-ring/25 inline-flex items-center gap-1.5 rounded-[5px] px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 [&_svg]:size-4",
              selected
                ? "bg-card text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
