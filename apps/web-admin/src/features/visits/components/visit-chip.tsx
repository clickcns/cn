import {
  PROGRAM_LABELS,
  staffDisplayName,
  VISIT_STATUS_LABELS,
  type VisitCalendarItem,
} from "@repo/shared-types";
import type { DragEvent, KeyboardEvent } from "react";
import { visitTime } from "@/features/visits/lib/calendar-items";
import { VISIT_STATUS_STYLES } from "@/features/visits/lib/status-styles";
import { cn } from "@/lib/utils";

export type ChipLabel = "recipient" | "staff";

interface VisitChipProps {
  item: VisitCalendarItem;
  /** 칩 이름: 보통은 수급자, 수급자 한 명만 볼 때는 담당자 */
  label: ChipLabel;
  onOpen: (item: VisitCalendarItem) => void;
  /** 끌어다 놓기 속성(useCalendarDnd().chipProps) */
  dragProps?: {
    draggable: boolean;
    onDragStart?: (event: DragEvent<HTMLElement>) => void;
    onDragEnd?: () => void;
  };
  /** 칸 안 칩 사이 방향키 이동(달력이 처리) */
  onKeyNavigate?: (event: KeyboardEvent<HTMLElement>) => void;
  /** Tab으로 들어갈 수 있는지. 달력 칸 안에서는 칸에서 Enter로 들어간다(-1). */
  focusable?: boolean;
}

/** 달력 칸의 방문 한 건: "09:30 김영자". 누르면 빠른 보기 창을 연다. */
export function VisitChip({
  item,
  label,
  onOpen,
  dragProps,
  onKeyNavigate,
  focusable = false,
}: VisitChipProps) {
  const { tone, icon: Icon } = VISIT_STATUS_STYLES[item.status];
  const time = visitTime(item);
  // 칸이 좁아(약 110px) 이름만 쓴다. 직종은 설명(title)과 빠른 보기에 있다.
  const name = label === "staff" ? item.staff.name : item.recipient.name;
  const description = [
    time,
    item.recipient.name,
    PROGRAM_LABELS[item.program],
    `담당 ${staffDisplayName(item.staff)}${item.staff.isActive ? "" : " 비활성"}`,
    VISIT_STATUS_LABELS[item.status],
  ].join(", ");

  return (
    <div
      role="button"
      tabIndex={focusable ? 0 : -1}
      data-chip={item.id}
      aria-label={description}
      title={`${description}${dragProps?.draggable ? " · 끌어서 다른 날로 옮길 수 있습니다" : ""}`}
      onClick={(event) => {
        // 칸을 고르지 않고(부모로 올리지 않고) 빠른 보기만 연다.
        event.stopPropagation();
        onOpen(item);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onOpen(item);
          return;
        }
        onKeyNavigate?.(event);
      }}
      {...dragProps}
      className={cn(
        "focus-visible:ring-ring/40 flex min-w-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs leading-5 outline-none select-none focus-visible:ring-2",
        tone,
        dragProps?.draggable && "active:cursor-grabbing",
        !item.staff.isActive && "ring-destructive/50 ring-1",
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="shrink-0 tabular-nums">{time}</span>
      <span className="text-foreground truncate font-medium">{name}</span>
    </div>
  );
}
