import { TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 막지는 않지만 알아야 할 안내 줄(같은 날 산정 제외, 의사 1인당 한도 등). compact는 표 칸 안에
 * 넣는 작은 글(바탕 없음)이다.
 */
export function WarningList({
  warnings,
  compact = false,
}: {
  warnings: readonly string[];
  compact?: boolean;
}) {
  return warnings.map((warning) => (
    <p
      key={warning}
      role="status"
      className={cn(
        "text-warning flex items-start",
        compact
          ? "max-w-md gap-1.5 text-xs"
          : "bg-warning-soft gap-2 rounded-md px-3 py-2 text-sm",
      )}
    >
      <TriangleAlertIcon
        className={cn("shrink-0", compact ? "mt-px size-3.5" : "mt-0.5 size-4")}
        aria-hidden
      />
      {warning}
    </p>
  ));
}
