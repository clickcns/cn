import { Building2Icon, ChevronRightIcon } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { compareText } from "@/hooks/use-table-sort";
import { cn } from "@/lib/utils";

/*
 * 표 행을 기관별로 나눠 보여 준다. 묶음 머리 줄을 눌러 접고 편다(처음에는 모두 펼친다).
 * 정렬과 함께 쓰면 정렬한 행을 넘긴다(묶음 안에서 정렬된다).
 */

interface RowGroup<T> {
  /** 묶음 키. ""는 "소속 없음" 같은 묶음으로 맨 앞에 둔다. */
  key: string;
  label: string;
  rows: T[];
}

/** 묶음은 이름 가나다순(빈 키 묶음이 맨 앞), 묶음 안은 들어온 순서 그대로. */
function groupRows<T>(
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

/** 기관별 묶음 머리 줄: 누르면 그 기관 행을 접고 편다. */
function TableGroupRow({
  colSpan,
  label,
  detail,
  open,
  onToggle,
}: {
  colSpan: number;
  label: string;
  detail: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={colSpan} className="h-10 py-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="focus-visible:ring-ring/40 -mx-1.5 inline-flex items-center gap-2 rounded-md px-1.5 py-1 outline-none focus-visible:ring-2"
        >
          <ChevronRightIcon
            aria-hidden
            className={cn(
              "text-muted-foreground size-4 transition-transform",
              open && "rotate-90",
            )}
          />
          <Building2Icon aria-hidden className="text-muted-foreground size-4" />
          <span className="font-semibold">{label}</span>
          <span className="text-muted-foreground text-[13px]">{detail}</span>
        </button>
      </TableCell>
    </TableRow>
  );
}

/** 기관별로 묶은 표 본문 행들. 묶음마다 머리 줄과(펼쳤으면) 그 기관의 행. */
export function OrganizationGroupedRows<T extends { isActive: boolean }>({
  rows,
  groupOf,
  colSpan,
  renderRow,
}: {
  rows: readonly T[];
  /** 행이 속한 묶음(기관 id·이름). 키가 ""이면 맨 앞 묶음이다. */
  groupOf: (row: T) => { key: string; label: string };
  colSpan: number;
  renderRow: (row: T) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return groupRows(rows, groupOf).map((group) => {
    const open = !collapsed.has(group.key);
    const active = group.rows.filter((row) => row.isActive).length;
    return (
      <Fragment key={group.key}>
        <TableGroupRow
          colSpan={colSpan}
          label={group.label}
          detail={`${group.rows.length}명 · 활성 ${active}명`}
          open={open}
          onToggle={() => toggle(group.key)}
        />
        {open && group.rows.map(renderRow)}
      </Fragment>
    );
  });
}
