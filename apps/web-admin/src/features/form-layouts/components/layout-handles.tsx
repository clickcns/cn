import {
  itemInstanceRects,
  rectsIntersect,
  roundPt,
  type DragMode,
  type FormLayoutAdjustments,
  type FormLayoutItem,
  type LayoutRect,
  type SelectMode,
  type SnapGuides,
} from "@repo/shared-types";
import { memo, useMemo, useRef, useState } from "react";
import { isAdditive } from "@/features/form-layouts/lib/modifier-keys";
import { cn } from "@/lib/utils";

/** 칸 종류별 쌓는 순서: 여러 줄 글 칸 위에 한 줄 칸, 그 위에 □·○ 표시(작은 것이 위). */
const KIND_ORDER: Record<FormLayoutItem["kind"], number> = {
  paragraph: 0,
  text: 1,
  mark: 2,
};

/** □·○ 표시 손잡이 크기(px). */
const MARK_HANDLE = 10;
/**
 * 이보다 짧게 움직이면 누르기로 본다(px): 빈 곳이면 사각형 선택이 아니라 선택 해제, 손잡이면 옮기지
 * 않는다(손 떨림으로 칸이 맞춤선에 붙어 버리지 않게).
 */
const CLICK_SLOP = 3;
/** 다른 칸의 선에 이만큼(화면 px) 다가가면 붙는다. */
const SNAP_PX = 6;

interface Band {
  /** 레이어의 화면 위치(누를 때 한 번 잰다) */
  left: number;
  top: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  additive: boolean;
}

type Gesture =
  | { kind: "drag"; x: number; y: number; moved: boolean }
  | ({ kind: "band" } & Band);

/** 끈 사각형(px, 레이어 기준)을 좌상단·우하단 순서로. */
function bandRect(band: Band): LayoutRect {
  return {
    x0: Math.min(band.x0, band.x1),
    y0: Math.min(band.y0, band.y1),
    x1: Math.max(band.x0, band.x1),
    y1: Math.max(band.y0, band.y1),
  };
}

/** 손잡이 한 칸의 화면 자리(px, 레이어 기준). □·○ 표시는 가운데에 작은 네모. */
function handleBox(
  rect: LayoutRect,
  kind: FormLayoutItem["kind"],
  scale: number,
): { left: number; top: number; width: number; height: number } {
  return kind === "mark"
    ? {
        left: rect.x0 * scale - MARK_HANDLE / 2,
        top: rect.y0 * scale - MARK_HANDLE / 2,
        width: MARK_HANDLE,
        height: MARK_HANDLE,
      }
    : {
        left: rect.x0 * scale,
        top: rect.y0 * scale,
        width: (rect.x1 - rect.x0) * scale,
        height: (rect.y1 - rect.y0) * scale,
      };
}

/** 손잡이 한 칸. 값만 받아서 자리·상태가 바뀐 칸만 다시 그린다. 누르기는 레이어가 받는다. */
const LayoutHandle = memo(function LayoutHandle({
  id,
  column,
  label,
  kind,
  left,
  top,
  width,
  height,
  selected,
  adjusted,
  primary,
  showOutlines,
}: {
  id: string;
  column: number;
  label: string;
  kind: FormLayoutItem["kind"];
  left: number;
  top: number;
  width: number;
  height: number;
  selected: boolean;
  adjusted: boolean;
  primary: boolean;
  showOutlines: boolean;
}) {
  return (
    <div
      data-handle={id}
      data-column={column}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      role="button"
      className={cn(
        "absolute cursor-move",
        kind === "mark" ? "rounded-full" : "rounded-[2px]",
        showOutlines &&
          (adjusted
            ? "outline-warning/80 outline"
            : "outline-primary/30 outline"),
        "hover:bg-primary/10 hover:outline-primary hover:outline",
        selected &&
          "bg-primary/10 outline-primary z-10 outline-2 hover:outline-2",
        primary && "outline-3",
      )}
      style={{ left, top, width, height }}
    >
      {selected && kind !== "mark" && (
        <span
          data-resize
          aria-hidden
          className="bg-primary border-card absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-sm border-2"
        />
      )}
    </div>
  );
});

/**
 * PDF 미리보기 위의 칸 손잡이(WinForms 디자이너처럼). 누르기·끌기는 이 레이어가 한곳에서 받는다.
 * - 손잡이 누르기: 고르고 끌기 시작(고른 칸 모두 함께). Ctrl/Shift+누르기는 더하거나 빼기만.
 *   고른 글 칸의 오른쪽 아래 모서리를 끌면 고른 칸 모두 크기를 바꾼다.
 * - 끄는 동안 다른 칸의 가장자리·가운데 선에 가까워지면 붙고 맞춤선을 보여 준다(Alt 를 누르면 끈다).
 * - 빈 곳에서 끌면 사각형 안의 칸을 고른다(Ctrl/Shift면 더한다). 빈 곳을 누르면 선택을 푼다.
 * - 제7호 방문 칸(repeated)은 다섯 칸 모두에 손잡이를 둔다(어느 것을 끌어도 함께 움직인다).
 */
export function LayoutHandles({
  items,
  adjustments,
  adjustedIds,
  selectedIds,
  repeatOffsets,
  scale,
  showOutlines,
  guides,
  onSelect,
  onDragStart,
  onDrag,
  onDragEnd,
  onDragCancel,
}: {
  items: FormLayoutItem[];
  adjustments: FormLayoutAdjustments;
  /** 기본 자리에서 바뀐 칸(주황 테두리) */
  adjustedIds: ReadonlySet<string>;
  /** 고른 칸(첫째가 맞춤 기준) */
  selectedIds: readonly string[];
  repeatOffsets: number[];
  scale: number;
  showOutlines: boolean;
  /** 끄는 동안 붙은 맞춤선(pt, 쪽 좌표) */
  guides: SnapGuides;
  onSelect: (ids: string[], mode: SelectMode) => void;
  onDragStart: (id: string, column: number, mode: DragMode) => void;
  /** 끌기 시작점에서 움직인 거리(pt). snap 은 붙는 거리(pt), Alt 를 누르면 없다. */
  onDrag: (dx: number, dy: number, snap?: number) => void;
  onDragEnd: () => void;
  onDragCancel: () => void;
}) {
  const gesture = useRef<Gesture | null>(null);
  const [bandBox, setBandBox] = useState<LayoutRect | null>(null);
  const ordered = useMemo(
    () => [...items].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]),
    [items],
  );
  const selectedSet = new Set(selectedIds);
  const primaryId = selectedIds.length > 1 ? selectedIds[0] : undefined;

  const finishBand = (band: Band) => {
    setBandBox(null);
    const mode = band.additive ? "add" : "replace";
    const box = bandRect(band);
    if (box.x1 - box.x0 < CLICK_SLOP && box.y1 - box.y0 < CLICK_SLOP) {
      onSelect([], mode);
      return;
    }
    // 화면에 그린 손잡이(□·○ 표시는 작은 네모)와 겹치는 칸을 고른다.
    const hits = (item: FormLayoutItem, rect: LayoutRect) => {
      const { left, top, width, height } = handleBox(rect, item.kind, scale);
      return rectsIntersect(box, {
        x0: left,
        y0: top,
        x1: left + width,
        y1: top + height,
      });
    };
    onSelect(
      items
        .filter((item) =>
          itemInstanceRects(item, adjustments, repeatOffsets).some((rect) =>
            hits(item, rect),
          ),
        )
        .map((item) => item.id),
      mode,
    );
  };

  return (
    <div
      // 누르기의 기본 동작(포커스 옮기기)을 막으므로 직접 포커스를 가져온다. 그래야 입력 칸에 있던
      // 포커스가 빠지고 편집 화면 단축키(방향키·Delete·Ctrl+Z)가 이 화면으로 온다.
      tabIndex={-1}
      className="absolute inset-0 touch-none outline-none"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        const target = event.target as Element;
        const handle = target.closest<HTMLElement>("[data-handle]");
        const id = handle?.dataset.handle;
        if (id) {
          if (isAdditive(event)) {
            onSelect([id], "toggle");
            return;
          }
          onDragStart(
            id,
            Number(handle.dataset.column),
            target.closest("[data-resize]") ? "resize" : "move",
          );
          gesture.current = {
            kind: "drag",
            x: event.clientX,
            y: event.clientY,
            moved: false,
          };
        } else {
          const { left, top } = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - left;
          const y = event.clientY - top;
          const band = {
            kind: "band" as const,
            left,
            top,
            x0: x,
            y0: y,
            x1: x,
            y1: y,
            additive: isAdditive(event),
          };
          gesture.current = band;
          setBandBox(bandRect(band));
        }
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current) return;
        if (current.kind === "drag") {
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          if (!current.moved) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < CLICK_SLOP) return;
            current.moved = true;
          }
          onDrag(
            roundPt(dx / scale),
            roundPt(dy / scale),
            event.altKey ? undefined : SNAP_PX / scale,
          );
          return;
        }
        current.x1 = event.clientX - current.left;
        current.y1 = event.clientY - current.top;
        setBandBox(bandRect(current));
      }}
      onPointerUp={() => {
        const current = gesture.current;
        gesture.current = null;
        if (current?.kind === "drag") onDragEnd();
        else if (current) finishBand(current);
      }}
      onPointerCancel={() => {
        const current = gesture.current;
        gesture.current = null;
        setBandBox(null);
        if (current?.kind === "drag") onDragCancel();
      }}
    >
      {ordered.flatMap((item) =>
        itemInstanceRects(item, adjustments, repeatOffsets).map(
          (rect, column) => (
            <LayoutHandle
              key={`${item.id}@${column}`}
              id={item.id}
              column={column}
              label={item.label}
              kind={item.kind}
              {...handleBox(rect, item.kind, scale)}
              selected={selectedSet.has(item.id)}
              adjusted={adjustedIds.has(item.id)}
              primary={item.id === primaryId}
              showOutlines={showOutlines}
            />
          ),
        ),
      )}
      {guides.x !== undefined && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 z-20 w-px bg-fuchsia-500"
          style={{ left: guides.x * scale }}
        />
      )}
      {guides.y !== undefined && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-20 h-px bg-fuchsia-500"
          style={{ top: guides.y * scale }}
        />
      )}
      {bandBox && (
        <div
          aria-hidden
          className="border-primary bg-primary/10 pointer-events-none absolute z-20 border border-dashed"
          style={{
            left: bandBox.x0,
            top: bandBox.y0,
            width: bandBox.x1 - bandBox.x0,
            height: bandBox.y1 - bandBox.y0,
          }}
        />
      )}
    </div>
  );
}
