import {
  adjustPoint,
  adjustRect,
  clampLayoutAdjustment,
  MIN_RECT_PT,
  roundPt,
  type FormLayoutAdjustments,
  type FormLayoutItem,
  type LayoutItemAdjustment,
  type LayoutRect,
  type LayoutTextStyle,
} from "./form-layout.js";

/*
 * 원본 서식 조정 화면(관리 웹)의 편집 규칙: 칸 자리 계산, 선택, 맞춤, 맞춤선, 되돌리기 기록.
 * 화면과 무관한 순수 함수라 여기 두고 서버 테스트(form-layout-edit.spec.ts)가 확인한다.
 * 좌표는 pt, 좌상단 원점. 제7호 방문 칸(repeated)은 첫 칸 좌표이고 칸마다 repeatOffsets 만큼 옮겨 그린다.
 */

export type DragMode = "move" | "resize";

/** 조정한 칸의 자리(첫 칸 좌표). □·○ 표시는 크기 없는 칸(가운데 점)으로 본다. */
export function itemRect(
  item: FormLayoutItem,
  adjustments: FormLayoutAdjustments,
): LayoutRect {
  const adjustment = adjustments.items[item.id];
  if (item.kind === "mark") {
    const { x, y } = adjustPoint(item.point, adjustment, adjustments.page);
    return { x0: x, y0: y, x1: x, y1: y };
  }
  return adjustRect(item.rect, adjustment, adjustments.page);
}

export function offsetRect(rect: LayoutRect, dx: number, dy = 0): LayoutRect {
  return {
    x0: rect.x0 + dx,
    y0: rect.y0 + dy,
    x1: rect.x1 + dx,
    y1: rect.y1 + dy,
  };
}

/** 칸이 쪽 위에 그려지는 자리 모두(방문 칸은 다섯 칸, 그 밖의 칸은 하나). */
export function itemInstanceRects(
  item: FormLayoutItem,
  adjustments: FormLayoutAdjustments,
  repeatOffsets: readonly number[],
): LayoutRect[] {
  const rect = itemRect(item, adjustments);
  return item.repeated
    ? repeatOffsets.map((offset) => offsetRect(rect, offset))
    : [rect];
}

/** 여러 칸을 감싸는 칸. */
export function boundingRect(rects: readonly LayoutRect[]): LayoutRect {
  return {
    x0: Math.min(...rects.map((r) => r.x0)),
    y0: Math.min(...rects.map((r) => r.y0)),
    x1: Math.max(...rects.map((r) => r.x1)),
    y1: Math.max(...rects.map((r) => r.y1)),
  };
}

export function rectsIntersect(a: LayoutRect, b: LayoutRect): boolean {
  return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
}

/**
 * 조정을 저장할 수 있는 모양으로: 0.1pt로 반올림하고 한도(LAYOUT_LIMITS) 안으로, 글 칸은
 * 줄여도 폭·높이가 MIN_RECT_PT 아래로 내려가지 않게 한다(그리는 크기와 저장 값이 어긋나지 않게).
 */
export function normalizeItemAdjustment(
  item: FormLayoutItem,
  adjustment: LayoutItemAdjustment,
): LayoutItemAdjustment {
  const next = clampLayoutAdjustment(adjustment);
  for (const key of ["dx", "dy", "dw", "dh"] as const) {
    if (next[key] !== undefined) next[key] = roundPt(next[key]);
  }
  if (item.kind !== "mark") {
    const { x0, y0, x1, y1 } = item.rect;
    if (next.dw !== undefined)
      next.dw = Math.max(next.dw, roundPt(MIN_RECT_PT - (x1 - x0)));
    if (next.dh !== undefined)
      next.dh = Math.max(next.dh, roundPt(MIN_RECT_PT - (y1 - y0)));
  }
  return next;
}

/** 옮기기(move: dx·dy) 또는 크기 바꾸기(resize: dw·dh, 글 칸만)를 더한다. 표시 칸의 크기는 null. */
export function shiftAdjustment(
  item: FormLayoutItem,
  adjustment: LayoutItemAdjustment,
  dx: number,
  dy: number,
  mode: DragMode,
): LayoutItemAdjustment | null {
  if (mode === "resize" && item.kind === "mark") return null;
  const [kx, ky] =
    mode === "move" ? (["dx", "dy"] as const) : (["dw", "dh"] as const);
  return normalizeItemAdjustment(item, {
    ...adjustment,
    [kx]: (adjustment[kx] ?? 0) + dx,
    [ky]: (adjustment[ky] ?? 0) + dy,
  });
}

/** 표시 칸(□·○·동그라미)의 표시 크기를 바꾼다(글 칸은 null). undefined 면 기본 크기로. */
export function markSizeAdjustment(
  item: FormLayoutItem,
  adjustment: LayoutItemAdjustment,
  size: number | undefined,
): LayoutItemAdjustment | null {
  if (item.kind !== "mark") return null;
  return normalizeItemAdjustment(item, { ...adjustment, size });
}

/** 글 칸에 글자 모양을 입힌다(표시 칸은 null, 여러 줄 글 칸은 왼쪽 정렬뿐이라 정렬은 뺀다). */
export function styleAdjustment(
  item: FormLayoutItem,
  adjustment: LayoutItemAdjustment,
  patch: Partial<LayoutTextStyle>,
): LayoutItemAdjustment | null {
  if (item.kind === "mark") return null;
  const next = normalizeItemAdjustment(item, { ...adjustment, ...patch });
  if (item.kind === "paragraph") delete next.align;
  return next;
}

function sameAdjustment(
  a: LayoutItemAdjustment | undefined,
  b: LayoutItemAdjustment,
): boolean {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b)]);
  return [...keys].every(
    (key) =>
      a?.[key as keyof LayoutItemAdjustment] ===
      b[key as keyof LayoutItemAdjustment],
  );
}

/**
 * items 칸마다 change 로 새 조정을 만들어 넣는다(null 이면 그 칸은 그대로). 바뀐 칸이 없으면
 * 같은 객체를 돌려준다(되돌리기 기록·다시 그리기를 만들지 않게).
 */
export function patchLayoutItems(
  adjustments: FormLayoutAdjustments,
  items: readonly FormLayoutItem[],
  change: (
    adjustment: LayoutItemAdjustment,
    item: FormLayoutItem,
  ) => LayoutItemAdjustment | null,
): FormLayoutAdjustments {
  let next: FormLayoutAdjustments["items"] | undefined;
  for (const item of items) {
    const current = adjustments.items[item.id];
    const adjustment = change(current ?? {}, item);
    if (!adjustment || sameAdjustment(current, adjustment)) continue;
    next ??= { ...adjustments.items };
    next[item.id] = adjustment;
  }
  return next ? { ...adjustments, items: next } : adjustments;
}

/* ---------- 맞춤 ---------- */

type Axis = "x" | "y";
const start = (r: LayoutRect, axis: Axis) => (axis === "x" ? r.x0 : r.y0);
const end = (r: LayoutRect, axis: Axis) => (axis === "x" ? r.x1 : r.y1);
const middle = (r: LayoutRect, axis: Axis) =>
  (start(r, axis) + end(r, axis)) / 2;

/** 맞춤 방법: 맞추는 축, 바꾸는 조정 값(옮기기·크기), 필요한 칸 수(간격 같게는 셋 이상). */
export const ALIGN_MODES = {
  left: { axis: "x", key: "dx", min: 2 },
  centerX: { axis: "x", key: "dx", min: 2 },
  right: { axis: "x", key: "dx", min: 2 },
  top: { axis: "y", key: "dy", min: 2 },
  centerY: { axis: "y", key: "dy", min: 2 },
  bottom: { axis: "y", key: "dy", min: 2 },
  sameWidth: { axis: "x", key: "dw", min: 2 },
  sameHeight: { axis: "y", key: "dh", min: 2 },
  spaceX: { axis: "x", key: "dx", min: 3 },
  spaceY: { axis: "y", key: "dy", min: 3 },
} as const satisfies Record<
  string,
  { axis: Axis; key: "dx" | "dy" | "dw" | "dh"; min: number }
>;
export type AlignMode = keyof typeof ALIGN_MODES;

/**
 * 고른 칸(selected, 첫째가 기준 칸)을 맞춘다. 바뀐 칸이 없으면 같은 객체를 돌려준다.
 * - 맞춤: 기준 칸의 왼쪽·가운데·오른쪽(위·가운데·아래)에 나머지를 옮긴다.
 * - 같은 너비·높이: 글 칸만 기준 칸 크기로(표시는 크기가 없다).
 * - 간격 같게: 양 끝 칸은 두고 사이 칸을 옮겨 칸 사이 간격을 같게 한다.
 * 방문 칸도 첫 칸 좌표로 맞춘다(다섯 칸이 함께 움직인다).
 */
export function alignItems(
  selected: readonly FormLayoutItem[],
  adjustments: FormLayoutAdjustments,
  mode: AlignMode,
): FormLayoutAdjustments {
  const [primary] = selected;
  const { axis, key, min } = ALIGN_MODES[mode];
  if (!primary || selected.length < min) return adjustments;
  const reference = itemRect(primary, adjustments);
  const deltas = new Map<string, number>();

  switch (mode) {
    case "sameWidth":
    case "sameHeight": {
      if (primary.kind === "mark") return adjustments;
      const size = end(reference, axis) - start(reference, axis);
      for (const item of selected.slice(1)) {
        if (item.kind === "mark") continue;
        const rect = itemRect(item, adjustments);
        deltas.set(item.id, size - (end(rect, axis) - start(rect, axis)));
      }
      break;
    }
    case "spaceX":
    case "spaceY": {
      const placed = selected
        .map((item) => ({ item, rect: itemRect(item, adjustments) }))
        .sort((a, b) => start(a.rect, axis) - start(b.rect, axis));
      const first = placed[0].rect;
      const last = placed[placed.length - 1].rect;
      const sizes = placed.map(
        ({ rect }) => end(rect, axis) - start(rect, axis),
      );
      const total = sizes.reduce((sum, size) => sum + size, 0);
      const gap =
        (end(last, axis) - start(first, axis) - total) / (placed.length - 1);
      let at = start(first, axis);
      placed.forEach(({ item, rect }, index) => {
        deltas.set(item.id, at - start(rect, axis));
        at += sizes[index] + gap;
      });
      break;
    }
    default: {
      const edge =
        mode === "left" || mode === "top"
          ? start
          : mode === "right" || mode === "bottom"
            ? end
            : middle;
      for (const item of selected.slice(1)) {
        const rect = itemRect(item, adjustments);
        deltas.set(item.id, edge(reference, axis) - edge(rect, axis));
      }
    }
  }

  return patchLayoutItems(adjustments, selected, (adjustment, item) => {
    const delta = deltas.get(item.id);
    if (delta === undefined || roundPt(delta) === 0) return null;
    return normalizeItemAdjustment(item, {
      ...adjustment,
      [key]: (adjustment[key] ?? 0) + delta,
    });
  });
}

/* ---------- 맞춤선 ---------- */

/** 끌 때 붙은 맞춤선(pt, 쪽 좌표). x 는 세로선, y 는 가로선. */
export interface SnapGuides {
  x?: number;
  y?: number;
}

export const NO_GUIDES: SnapGuides = {};

/**
 * 끄는 칸(moving)의 가장자리·가운데가 다른 칸(targets)의 왼쪽·가운데·오른쪽(위·가운데·아래)
 * 선에서 threshold 안이면 가장 가까운 선에 붙이는 거리와 그 선을 돌려준다(WinForms 맞춤선처럼).
 * endOnly 는 크기를 바꿀 때: 오른쪽·아래 가장자리만 맞춘다.
 */
export function snapToLines(
  moving: LayoutRect,
  targets: readonly LayoutRect[],
  threshold: number,
  endOnly = false,
): { dx: number; dy: number; guides: SnapGuides } {
  const snap = (axis: Axis) => {
    const edges = endOnly
      ? [end(moving, axis)]
      : [start(moving, axis), middle(moving, axis), end(moving, axis)];
    let best: { delta: number; line: number } | undefined;
    for (const target of targets) {
      for (const line of [
        start(target, axis),
        middle(target, axis),
        end(target, axis),
      ]) {
        for (const edge of edges) {
          const delta = line - edge;
          if (
            Math.abs(delta) <= threshold &&
            (!best || Math.abs(delta) < Math.abs(best.delta))
          ) {
            best = { delta, line };
          }
        }
      }
    }
    return best;
  };
  const x = snap("x");
  const y = snap("y");
  return {
    dx: x?.delta ?? 0,
    dy: y?.delta ?? 0,
    guides: x || y ? { x: x?.line, y: y?.line } : NO_GUIDES,
  };
}

/* ---------- 선택 ---------- */

/**
 * replace: 이 칸들만(지금 기준 칸이 들어 있으면 그대로 기준으로), add: 더하기,
 * toggle: 칸마다 넣거나 빼기, focus: 한 칸 — 고른 칸이면 여럿 고른 채로 기준으로, 아니면 그 칸만.
 */
export type SelectMode = "replace" | "add" | "toggle" | "focus";

/** 고른 칸 ID(첫째가 맞춤 기준). 바뀐 것이 없으면 같은 배열을 돌려준다. */
export function nextSelection(
  current: readonly string[],
  ids: readonly string[],
  mode: SelectMode,
): readonly string[] {
  let next: string[];
  switch (mode) {
    case "replace": {
      const [primary] = current;
      next =
        primary !== undefined && ids.includes(primary)
          ? [primary, ...ids.filter((id) => id !== primary)]
          : [...ids];
      break;
    }
    case "add":
      next = [...current, ...ids.filter((id) => !current.includes(id))];
      break;
    case "toggle":
      next = [
        ...current.filter((id) => !ids.includes(id)),
        ...ids.filter((id) => !current.includes(id)),
      ];
      break;
    case "focus": {
      const [id] = ids;
      next = current.includes(id)
        ? [id, ...current.filter((other) => other !== id)]
        : [id];
      break;
    }
  }
  return next.length === current.length &&
    next.every((id, i) => id === current[i])
    ? current
    : next;
}

/* ---------- 되돌리기 기록 ---------- */

/** 되돌리기 칸 수(오래된 것부터 버린다). */
const HISTORY_LIMIT = 100;
/** 같은 mergeKey 의 변경이 이 안에 이어지면 한 걸음으로 합친다(방향키 연타·숫자 입력). */
const HISTORY_MERGE_MS = 1000;

/**
 * 되돌리기(Ctrl+Z)·다시 하기(Ctrl+Y) 기록. 끌기처럼 이어지는 조작은 begin → apply… → commit
 * (또는 cancel)으로 한 걸음이 된다(checkpoint 는 시작 전 값).
 */
export interface EditHistory<T> {
  past: T[];
  present: T;
  future: T[];
  checkpoint: T | null;
  mergeKey: string | null;
  at: number;
}

export function createHistory<T>(present: T): EditHistory<T> {
  return {
    past: [],
    present,
    future: [],
    checkpoint: null,
    mergeKey: null,
    at: 0,
  };
}

/**
 * 새 값을 넣는다. 조작 중(checkpoint)이면 지금 값만 바꾸고, 아니면 한 걸음 남긴다(같은 mergeKey 가
 * HISTORY_MERGE_MS 안에 이어지면 합친다). 값이 같으면(같은 객체) 그대로.
 */
export function historyApply<T>(
  history: EditHistory<T>,
  next: T,
  { mergeKey, now }: { mergeKey?: string; now: number },
): EditHistory<T> {
  if (next === history.present) return history;
  if (history.checkpoint !== null) return { ...history, present: next };
  const merge =
    mergeKey !== undefined &&
    mergeKey === history.mergeKey &&
    now - history.at < HISTORY_MERGE_MS;
  return {
    past: merge
      ? history.past
      : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    checkpoint: null,
    mergeKey: mergeKey ?? null,
    at: now,
  };
}

/** 이어지는 조작(끌기)을 시작한다. */
export function historyBegin<T>(history: EditHistory<T>): EditHistory<T> {
  return history.checkpoint !== null
    ? history
    : { ...history, checkpoint: history.present };
}

/** 조작을 한 걸음으로 남긴다(바뀐 것이 없으면 남기지 않는다). */
export function historyCommit<T>(history: EditHistory<T>): EditHistory<T> {
  const { checkpoint } = history;
  if (checkpoint === null) return history;
  if (checkpoint === history.present) return { ...history, checkpoint: null };
  return {
    ...history,
    past: [...history.past, checkpoint].slice(-HISTORY_LIMIT),
    future: [],
    checkpoint: null,
    mergeKey: null,
  };
}

/** 조작을 버리고 시작 전 값으로 돌아간다. */
export function historyCancel<T>(history: EditHistory<T>): EditHistory<T> {
  return history.checkpoint === null
    ? history
    : { ...history, present: history.checkpoint, checkpoint: null };
}

export function historyUndo<T>(history: EditHistory<T>): EditHistory<T> {
  const previous = history.past.at(-1);
  if (history.checkpoint !== null || previous === undefined) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    mergeKey: null,
  };
}

export function historyRedo<T>(history: EditHistory<T>): EditHistory<T> {
  const [next, ...future] = history.future;
  if (history.checkpoint !== null || next === undefined) return history;
  return {
    ...history,
    past: [...history.past, history.present],
    present: next,
    future,
    mergeKey: null,
  };
}
