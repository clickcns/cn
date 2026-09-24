import { useState } from "react";

/*
 * 표 머리 칸을 눌러 정렬한다: 오름차순 → 내림차순 → 해제(서버가 준 순서).
 * 목록 전체를 한 번에 받는 표(사용자·수급자·기관)에만 쓴다. 페이지로 나눠 받는 표는 서버가 정렬해야 한다.
 */

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/** 정렬 값. null(값 없음)은 방향과 관계없이 맨 뒤에 둔다. */
export type SortValue = string | number | null;

/** 정렬 칸마다 행의 정렬 값을 꺼내는 함수. 키가 곧 정렬할 수 있는 칸이다. */
export type SortValues<T> = Record<string, (row: T) => SortValue>;

const collator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

/** 한글 가나다순(숫자는 크기순) 비교 */
export const compareText = (a: string, b: string) => collator.compare(a, b);

function compareValues(a: string | number, b: string | number): number {
  return typeof a === "number" && typeof b === "number"
    ? a - b
    : compareText(String(a), String(b));
}

export function useTableSort<K extends string>() {
  const [sort, setSort] = useState<SortState<K> | null>(null);
  const toggle = (key: K) =>
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      return current.direction === "asc" ? { key, direction: "desc" } : null;
    });
  return { sort, toggle };
}

export type TableSort<K extends string> = ReturnType<typeof useTableSort<K>>;

/** 정렬한 새 배열. 같은 값끼리는 원래 순서를 지킨다. */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K> | null,
  values: Record<K, (row: T) => SortValue>,
): T[] {
  if (!sort) return [...rows];
  const sign = sort.direction === "asc" ? 1 : -1;
  const valueOf = values[sort.key];
  return rows
    .map((row) => ({ row, value: valueOf(row) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        return Number(a.value === null) - Number(b.value === null);
      }
      return sign * compareValues(a.value, b.value);
    })
    .map(({ row }) => row);
}
