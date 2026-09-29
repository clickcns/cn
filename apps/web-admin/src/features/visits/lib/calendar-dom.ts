/*
 * 달력 DOM 표시. 칸은 role="gridcell"·data-date(YYYY-MM-DD)·aria-selected(고른 날),
 * 칩은 data-chip(방문 id), 칸의 "+N건 더"는 data-chip-more다. 포커스를 옮기거나
 * 우클릭한 곳을 찾을 때 이 파일의 선택자만 쓴다.
 */

/** 날짜 칸(아무 날짜) */
export const CELL_SELECTOR = '[role="gridcell"][data-date]';
/** 방문 칩(아무 방문) */
export const CHIP_SELECTOR = "[data-chip]";
/** 칸 안에서 방향키로 오가는 것: 칩과 "+N건 더" */
export const CHIP_OR_MORE_SELECTOR = "[data-chip], [data-chip-more]";

export function cellSelector(date: string): string {
  return `[role="gridcell"][data-date="${date}"]`;
}

/** 그 날짜 칸 */
export function findCell(date: string, root: ParentNode = document) {
  return root.querySelector<HTMLElement>(cellSelector(date));
}

/** 그 방문의 칩(달력 칸에 보이는 것) */
export function findChip(visitId: string) {
  return document.querySelector<HTMLElement>(`[data-chip="${visitId}"]`);
}

/** 고른 날 칸(Tab으로 들어오는 칸) */
export function findSelectedCell() {
  return document.querySelector<HTMLElement>(
    '[role="gridcell"][aria-selected="true"]',
  );
}
