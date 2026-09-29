import { Building2Icon, ChevronRightIcon, FilterIcon } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { useSetScopeOrganization } from "@/features/organizations/hooks/use-organization-scope";
import { groupRows } from "@/features/organizations/lib/group-rows";
import { cn } from "@/lib/utils";

/*
 * 표 행을 기관별로 나눠 보여 준다(운영자의 "전체 기관" 목록). 묶음 머리 줄을 눌러 접고 펴고
 * (처음에는 모두 펼친다), [이 기관만 보기]로 그 기관만 본다. 정렬과 함께 쓰면 정렬한 행을
 * 넘긴다(묶음 안에서 정렬된다).
 */

/** 기관별 묶음 머리 줄: 누르면 그 기관 행을 접고 편다. */
function TableGroupRow({
  colSpan,
  label,
  detail,
  open,
  onToggle,
  onSelect,
}: {
  colSpan: number;
  label: string;
  detail: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** 있으면 오른쪽에 [이 기관만 보기]를 둔다. */
  onSelect?: () => void;
}) {
  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={colSpan} className="h-10 py-1.5">
        <div className="flex items-center justify-between gap-3">
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
            <Building2Icon
              aria-hidden
              className="text-muted-foreground size-4"
            />
            <span className="font-semibold">{label}</span>
            <span className="text-muted-foreground text-[13px]">{detail}</span>
          </button>
          {onSelect && (
            <button
              type="button"
              onClick={onSelect}
              aria-label={`${label}만 보기`}
              className="text-muted-foreground hover:text-primary focus-visible:ring-ring/40 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-medium outline-none focus-visible:ring-2"
            >
              <FilterIcon aria-hidden className="size-3.5" />이 기관만 보기
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** 기관별로 묶은 표 본문 행들. 묶음마다 머리 줄과(펼쳤으면) 그 기관의 행. */
export function OrganizationGroupedRows<T>({
  rows,
  groupOf,
  colSpan,
  renderRow,
  detail,
}: {
  rows: readonly T[];
  /** 행이 속한 묶음(기관 id·이름). 키가 ""이면 맨 앞 묶음이다. */
  groupOf: (row: T) => { key: string; label: string };
  colSpan: number;
  renderRow: (row: T) => ReactNode;
  /** 묶음 머리 줄의 건수 설명 */
  detail: (rows: readonly T[], key: string) => ReactNode;
}) {
  // [이 기관만 보기]: 운영자의 기관 선택을 그 기관으로 바꾼다.
  const setScopeOrganization = useSetScopeOrganization();
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
    return (
      <Fragment key={group.key}>
        <TableGroupRow
          colSpan={colSpan}
          label={group.label}
          detail={detail(group.rows, group.key)}
          open={open}
          onToggle={() => toggle(group.key)}
          onSelect={
            group.key !== "" ? () => setScopeOrganization(group.key) : undefined
          }
        />
        {open && group.rows.map(renderRow)}
      </Fragment>
    );
  });
}
