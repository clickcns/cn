import { addMonths, formatMonthLabel } from "@repo/shared-types";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** 달 넘기기: [<] 2026년 10월 [>] [이번 달]. busy면 받는 중 표시를 붙인다. */
export function MonthNav({
  month,
  thisMonth,
  onChange,
  busy = false,
}: {
  /** YYYY-MM */
  month: string;
  thisMonth: string;
  onChange: (month: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="이전 달"
        onClick={() => onChange(addMonths(month, -1))}
      >
        <ChevronLeftIcon />
      </Button>
      <h2
        className="min-w-28 text-center text-base font-semibold tabular-nums"
        aria-live="polite"
      >
        {formatMonthLabel(month)}
      </h2>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="다음 달"
        onClick={() => onChange(addMonths(month, 1))}
      >
        <ChevronRightIcon />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="ml-1"
        disabled={month === thisMonth}
        onClick={() => onChange(thisMonth)}
      >
        이번 달
      </Button>
      {busy && <Spinner className="ml-2" />}
    </div>
  );
}
