import { compareText } from "@/hooks/use-table-sort";

export interface RowGroup<T> {
  /** 묶음 키(기관 id). ""는 "소속 없음" 같은 묶음으로 맨 앞에 둔다. */
  key: string;
  label: string;
  rows: T[];
}

/**
 * 행을 기관별로 묶는다. 묶음은 이름 가나다순(빈 키 묶음이 맨 앞), 묶음 안은 들어온 순서 그대로.
 * 기관별 표와 달력의 수급자 패널이 같은 순서를 쓴다.
 */
export function groupRows<T>(
  rows: readonly T[],
  groupOf: (row: T) => { key: string; label: string },
): RowGroup<T>[] {
  const groups = new Map<string, RowGroup<T>>();
  for (const row of rows) {
    const { key, label } = groupOf(row);
    let group = groups.get(key);
    if (!group) {
      group = { key, label, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) =>
    a.key === "" ? -1 : b.key === "" ? 1 : compareText(a.label, b.label),
  );
}
