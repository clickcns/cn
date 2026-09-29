import {
  adjustPoint,
  adjustRect,
  roundPt,
  type FormLayoutAdjustments,
  type FormLayoutItem,
  type LayoutItemAdjustment,
} from "@repo/shared-types";
import type * as React from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/** 칸 종류별 쌓는 순서: 여러 줄 글 칸 위에 한 줄 칸, 그 위에 □·○ 표시(작은 것이 위). */
const KIND_ORDER: Record<FormLayoutItem["kind"], number> = {
  paragraph: 0,
  text: 1,
  mark: 2,
};

/** □·○ 표시 손잡이 크기(px). */
const MARK_HANDLE = 10;

interface Drag {
  id: string;
  mode: "move" | "resize";
  x: number;
  y: number;
  /** 끌기 시작할 때의 조정 */
  base: LayoutItemAdjustment;
  /** 마지막으로 알린 움직임(pt). 같으면 다시 알리지 않는다. */
  last: string;
}

/**
 * PDF 미리보기 위에 칸마다 손잡이를 둔다. 누르면 고르고, 끌면 옮기고, 고른 글 칸의 오른쪽 아래
 * 모서리를 끌면 칸 크기를 바꾼다. 제7호 방문 칸(repeated)은 다섯 칸에 모두 손잡이를 두고 어느
 * 것을 끌어도 함께 움직인다.
 */
export function LayoutHandles({
  items,
  adjustments,
  adjustedIds,
  repeatOffsets,
  scale,
  selectedId,
  showOutlines,
  onSelect,
  onChange,
}: {
  items: FormLayoutItem[];
  adjustments: FormLayoutAdjustments;
  /** 기본 자리에서 바뀐 칸(주황 테두리) */
  adjustedIds: ReadonlySet<string>;
  repeatOffsets: number[];
  scale: number;
  selectedId: string | null;
  showOutlines: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: LayoutItemAdjustment) => void;
}) {
  const drag = useRef<Drag | null>(null);

  const begin = (
    event: React.PointerEvent<HTMLElement>,
    item: FormLayoutItem,
    mode: Drag["mode"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(item.id);
    drag.current = {
      id: item.id,
      mode,
      x: event.clientX,
      y: event.clientY,
      base: adjustments.items[item.id] ?? {},
      last: "0,0",
    };
    // 놓을 때까지 이 손잡이가 움직임을 받는다(모서리 손잡이의 움직임도 바깥 손잡이로 올라온다).
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = roundPt((event.clientX - current.x) / scale);
    const dy = roundPt((event.clientY - current.y) / scale);
    if (`${dx},${dy}` === current.last) return;
    current.last = `${dx},${dy}`;
    const { base } = current;
    onChange(
      current.id,
      current.mode === "move"
        ? { dx: (base.dx ?? 0) + dx, dy: (base.dy ?? 0) + dy }
        : { dw: (base.dw ?? 0) + dx, dh: (base.dh ?? 0) + dy },
    );
  };

  const end = () => {
    drag.current = null;
  };

  const ordered = [...items].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );

  return ordered.flatMap((item) => {
    const adjustment = adjustments.items[item.id];
    const selected = item.id === selectedId;
    const adjusted = adjustedIds.has(item.id);
    return (item.repeated ? repeatOffsets : [0]).map((offset, column) => {
      let style: React.CSSProperties;
      if (item.kind === "mark") {
        const point = adjustPoint(item.point, adjustment, adjustments.page);
        style = {
          left: (point.x + offset) * scale - MARK_HANDLE / 2,
          top: point.y * scale - MARK_HANDLE / 2,
          width: MARK_HANDLE,
          height: MARK_HANDLE,
        };
      } else {
        const rect = adjustRect(item.rect, adjustment, adjustments.page);
        style = {
          left: (rect.x0 + offset) * scale,
          top: rect.y0 * scale,
          width: (rect.x1 - rect.x0) * scale,
          height: (rect.y1 - rect.y0) * scale,
        };
      }
      return (
        <div
          key={`${item.id}@${column}`}
          // 목록에서 고르면 첫 칸 손잡이로 스크롤한다.
          data-item-id={column === 0 ? item.id : undefined}
          title={item.label}
          aria-label={item.label}
          aria-pressed={selected}
          role="button"
          className={cn(
            "absolute cursor-move touch-none",
            item.kind === "mark" ? "rounded-full" : "rounded-[2px]",
            showOutlines &&
              (adjusted
                ? "outline-warning/80 outline"
                : "outline-primary/30 outline"),
            "hover:bg-primary/10 hover:outline-primary hover:outline",
            selected &&
              "bg-primary/10 outline-primary z-10 outline-2 hover:outline-2",
          )}
          style={style}
          onPointerDown={(event) => begin(event, item, "move")}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {selected && item.kind !== "mark" && (
            <span
              aria-hidden
              className="bg-primary border-card absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-sm border-2"
              onPointerDown={(event) => begin(event, item, "resize")}
            />
          )}
        </div>
      );
    });
  });
}
