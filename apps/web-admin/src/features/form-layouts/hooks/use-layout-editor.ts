import {
  adjustStyle,
  alignItems,
  boundingRect,
  cleanLayoutAdjustments,
  clampLayoutAdjustment,
  itemInstanceRects,
  itemRect,
  markSizeAdjustment,
  NO_GUIDES,
  nextSelection,
  normalizeItemAdjustment,
  offsetRect,
  patchLayoutItems,
  roundPt,
  shiftAdjustment,
  snapToLines,
  styleAdjustment,
  type AlignMode,
  type DragMode,
  type FormLayoutAdjustments,
  type FormLayoutDetail,
  type FormLayoutItem,
  type LayoutItemAdjustment,
  type LayoutRect,
  type LayoutTextStyle,
  type SelectMode,
  type SnapGuides,
} from "@repo/shared-types";
import { useMemo, useRef, useState } from "react";
import { useLayoutHistory } from "@/features/form-layouts/hooks/use-layout-history";

/** 끌기 한 번. 시작 전 조정(base)에서 움직인 거리만큼 고른 칸을 바꾼다. */
interface DragSession {
  base: FormLayoutAdjustments;
  mode: DragMode;
  /** 잡은 손잡이가 방문 칸이면 그 칸의 가로 이동(맞춤선을 쪽 좌표로 계산한다) */
  offset: number;
  /** 맞춤선 대상(고르지 않은 칸의 쪽 위 자리 모두). 처음 움직일 때 한 번 만든다. */
  targets?: LayoutRect[];
  /** 마지막으로 적용한 움직임(같으면 다시 그리지 않는다) */
  last?: string;
}

/**
 * 원본 서식 조정 화면의 상태: 조정 초안(되돌리기 가능), 고른 칸(첫째가 맞춤 기준), 복사한 글자 모양,
 * 끄는 동안의 맞춤선. 편집 규칙(선택·맞춤·맞춤선·한도)은 shared-types form-layout-edit.ts 에 있다.
 * React Compiler 가 돌려주는 함수를 필요한 값이 바뀔 때만 새로 만들도록 메서드 대신 화살표 함수로 두고,
 * 컴파일러가 아직 못 다루는 문법(??= 등)은 쓰지 않는다(쓰면 이 훅 전체를 건너뛴다).
 */
export function useLayoutEditor(detail: FormLayoutDetail) {
  const { items, repeatOffsets } = detail;
  const history = useLayoutHistory<FormLayoutAdjustments>(detail.adjustments);
  const { present: draft, update, begin, commit, cancel } = history;
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [guides, setGuides] = useState<SnapGuides>(NO_GUIDES);
  const copiedStyle = useRef<LayoutTextStyle | null>(null);
  const drag = useRef<DragSession | null>(null);

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const selected = selectedIds.flatMap((id) => itemById.get(id) ?? []);
  const clean = cleanLayoutAdjustments(draft);
  const draftKey = JSON.stringify(clean);
  const dirty =
    draftKey !== JSON.stringify(cleanLayoutAdjustments(detail.adjustments));
  // 끄는 동안 조정한 칸 목록은 그대로라 같은 Set 을 넘긴다(목록·손잡이를 다시 그리지 않게).
  const adjustedKey = Object.keys(clean.items).join("\n");
  const adjustedIds = useMemo<ReadonlySet<string>>(
    () => new Set(adjustedKey ? adjustedKey.split("\n") : []),
    [adjustedKey],
  );
  const selectionKey = selectedIds.join();

  const select = (ids: readonly string[], mode: SelectMode) =>
    setSelectedIds((current) => nextSelection(current, ids, mode));

  const updateSelected = (
    change: (
      adjustment: LayoutItemAdjustment,
      item: FormLayoutItem,
    ) => LayoutItemAdjustment | null,
    mergeKey?: string,
  ) =>
    update((current) => patchLayoutItems(current, selected, change), mergeKey);

  /**
   * 끌기 시작점에서 움직인 거리(pt)에 맞춤선(snap pt 안, 없으면 끔)을 반영한 움직임. 옮기기는 고른 칸을
   * 감싸는 칸의 가장자리·가운데를, 크기는 잡은 칸(첫째)의 오른쪽·아래 가장자리를 맞춘다.
   */
  const snapped = (
    session: DragSession,
    dx: number,
    dy: number,
    snap?: number,
  ) => {
    if (snap === undefined || selected.length === 0) {
      return { dx, dy, guides: NO_GUIDES };
    }
    if (!session.targets) {
      session.targets = items
        .filter((item) => !selectedIds.includes(item.id))
        .flatMap((item) =>
          itemInstanceRects(item, session.base, repeatOffsets),
        );
    }
    const placed = (item: FormLayoutItem) =>
      offsetRect(
        itemRect(item, session.base),
        item.repeated ? session.offset : 0,
      );
    const resize = session.mode === "resize";
    const rect = resize
      ? placed(selected[0])
      : boundingRect(selected.map(placed));
    const moving = resize
      ? { ...rect, x1: rect.x1 + dx, y1: rect.y1 + dy }
      : offsetRect(rect, dx, dy);
    const result = snapToLines(moving, session.targets, snap, resize);
    return { dx: dx + result.dx, dy: dy + result.dy, guides: result.guides };
  };

  return {
    draft,
    clean,
    draftKey,
    dirty,
    adjustedIds,
    selected,
    selectedIds,
    guides,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: history.undo,
    redo: history.redo,
    select,
    selectAll: () =>
      select(
        items.map((item) => item.id),
        "replace",
      ),
    clearSelection: () => select([], "replace"),
    /** 서버에서 기본 자리로 되돌린 값을 한 걸음으로 넣는다(되돌리기로 이전 초안을 살릴 수 있다). */
    load: (adjustments: FormLayoutAdjustments) => update(() => adjustments),
    isDragging: () => drag.current !== null,

    /** 손잡이를 잡았다: 그 칸을 기준으로 고르고(이미 고른 칸이면 여럿 고른 채로) 끌기를 시작한다. */
    dragStart: (id: string, column: number, mode: DragMode) => {
      const item = itemById.get(id);
      if (!item) return;
      select([id], "focus");
      begin();
      drag.current = {
        base: draft,
        mode,
        offset: item.repeated ? (repeatOffsets[column] ?? 0) : 0,
      };
    },
    /** 끌기 시작점에서 움직인 거리(pt)만큼 고른 칸을 모두 옮기거나 크기를 바꾼다. */
    dragTo: (dx: number, dy: number, snap?: number) => {
      const session = drag.current;
      if (!session) return;
      const move = snapped(session, dx, dy, snap);
      const x = roundPt(move.dx);
      const y = roundPt(move.dy);
      const key = `${x},${y},${move.guides.x},${move.guides.y}`;
      if (key === session.last) return;
      session.last = key;
      setGuides(move.guides);
      updateSelected((_adjustment, item) =>
        shiftAdjustment(
          item,
          session.base.items[item.id] ?? {},
          x,
          y,
          session.mode,
        ),
      );
    },
    /** 끌기를 한 걸음으로 남긴다. */
    dragEnd: () => {
      drag.current = null;
      commit();
      setGuides(NO_GUIDES);
    },
    /** 끌기를 버리고 시작 전 자리로(Esc·끌기 취소). */
    dragCancel: () => {
      drag.current = null;
      cancel();
      setGuides(NO_GUIDES);
    },
    /** 방향키: 고른 칸을 함께 옮기거나(move) 크기를 바꾼다(resize). 연타는 한 걸음. */
    nudge: (dx: number, dy: number, mode: DragMode) =>
      updateSelected(
        (adjustment, item) => shiftAdjustment(item, adjustment, dx, dy, mode),
        `key-${mode}:${selectionKey}`,
      ),
    /** 한 칸의 값을 입력으로 바꾼다(같은 칸·같은 값을 이어 치면 한 걸음). */
    setItem: (id: string, patch: LayoutItemAdjustment) => {
      const item = itemById.get(id);
      if (!item) return;
      update(
        (current) =>
          patchLayoutItems(current, [item], (adjustment) =>
            normalizeItemAdjustment(item, { ...adjustment, ...patch }),
          ),
        `field:${id}:${Object.keys(patch).join()}`,
      );
    },
    /** 고른 글 칸의 글자 모양을 한꺼번에 바꾼다. */
    setStyle: (patch: Partial<LayoutTextStyle>) =>
      updateSelected(
        (adjustment, item) => styleAdjustment(item, adjustment, patch),
        `style:${Object.keys(patch).join()}:${selectionKey}`,
      ),
    /** 고른 표시 칸(□ 체크·○ 점·동그라미)의 표시 크기를 한꺼번에(undefined 면 기본 크기). */
    setMarkSize: (size: number | undefined) =>
      updateSelected(
        (adjustment, item) => markSizeAdjustment(item, adjustment, size),
        `mark-size:${selectionKey}`,
      ),
    /** 고른 칸을 기본 자리로(Delete). */
    resetSelection: () =>
      update((current) => {
        const kept = Object.entries(current.items).filter(
          ([id]) => !selectedIds.includes(id),
        );
        return kept.length === Object.keys(current.items).length
          ? current
          : { ...current, items: Object.fromEntries(kept) };
      }),
    /** 저장본으로 되돌린다(되돌리기로 다시 살릴 수 있다). */
    revert: () => update(() => detail.adjustments),
    setPage: (patch: { dx?: number; dy?: number }) =>
      update((current) => {
        const { dx = 0, dy = 0 } = clampLayoutAdjustment({
          ...current.page,
          ...patch,
        });
        return { ...current, page: { dx, dy } };
      }, "page"),
    /** 고른 칸을 맞춘다(기준은 첫째 칸). */
    align: (mode: AlignMode) =>
      update((current) => alignItems(selected, current, mode)),
    /** 기준 칸의 글자 모양(크기·굵기·정렬)을 기억한다. 표시 칸이면 false. */
    copyStyle: (): boolean => {
      const [primary] = selected;
      if (!primary || primary.kind === "mark") return false;
      copiedStyle.current = adjustStyle(primary.style, draft.items[primary.id]);
      return true;
    },
    /** 기억한 글자 모양을 고른 글 칸에 붙인다. 붙인 칸이 있으면 true. */
    pasteStyle: (): boolean => {
      const style = copiedStyle.current;
      if (!style || selected.every((item) => item.kind === "mark")) {
        return false;
      }
      updateSelected((adjustment, item) =>
        styleAdjustment(item, adjustment, style),
      );
      return true;
    },
  };
}
