import { formatDateLabel, type VisitCalendarItem } from "@repo/shared-types";
import { ChevronsUpDownIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  VisitChip,
  type ChipLabel,
} from "@/features/visits/components/visit-chip";
import { CELL_SELECTOR } from "@/features/visits/lib/calendar-dom";

/**
 * 칸에 다 못 보여 준 방문: "+N건"을 누르면 그날 방문 전체를 띄운다.
 * 아래 [모든 칸 펼치기]는 달력 칸마다 방문을 모두 보여 주게 바꾼다.
 */
export function DayOverflowPopover({
  date,
  items,
  hiddenCount,
  label,
  onOpen,
  onExpandAll,
}: {
  date: string;
  items: readonly VisitCalendarItem[];
  hiddenCount: number;
  label: ChipLabel;
  onOpen: (item: VisitCalendarItem) => void;
  onExpandAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // 펼치면 "+N" 버튼이 사라지므로 닫은 뒤 포커스를 그 칸으로 돌린다.
  const focusAfterExpand = useRef<HTMLElement | null>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          tabIndex={-1}
          data-chip-more
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 self-start rounded px-1.5 text-xs font-medium outline-none focus-visible:ring-2"
        >
          +{hiddenCount}건 더
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          const cell = focusAfterExpand.current;
          if (!cell) return;
          event.preventDefault();
          focusAfterExpand.current = null;
          cell.focus();
        }}
      >
        <p className="px-1 pb-2 text-[13px] font-semibold">
          {formatDateLabel(date)} · {items.length}건
        </p>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {items.map((item) => (
            <VisitChip
              key={item.id}
              item={item}
              label={label}
              focusable
              onOpen={(visit) => {
                setOpen(false);
                onOpen(visit);
              }}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => {
            focusAfterExpand.current =
              triggerRef.current?.closest<HTMLElement>(CELL_SELECTOR) ?? null;
            setOpen(false);
            onExpandAll();
          }}
        >
          <ChevronsUpDownIcon />
          모든 칸 펼치기
        </Button>
      </PopoverContent>
    </Popover>
  );
}
