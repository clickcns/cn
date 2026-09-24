import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TableHead } from "@/components/ui/table";
import type { TableSort } from "@/hooks/use-table-sort";
import { cn } from "@/lib/utils";

/** 눌러서 정렬하는 표 머리 칸(useTableSort 결과를 받는다). 지금 정렬 중인 칸은 방향 화살표를 보여 준다. */
export function SortableTableHead<K extends string>({
  sortKey,
  sorting: { sort, toggle },
  className,
  children,
}: {
  sortKey: K;
  sorting: TableSort<K>;
  className?: string;
  children: ReactNode;
}) {
  const direction = sort?.key === sortKey ? sort.direction : null;
  const Icon =
    direction === "asc"
      ? ArrowUpIcon
      : direction === "desc"
        ? ArrowDownIcon
        : ChevronsUpDownIcon;

  return (
    <TableHead
      className={className}
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : undefined
      }
    >
      <button
        type="button"
        onClick={() => toggle(sortKey)}
        className={cn(
          "hover:text-foreground focus-visible:ring-ring/40 -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium outline-none focus-visible:ring-2",
          direction && "text-foreground",
        )}
      >
        {children}
        <Icon
          aria-hidden
          className={cn("size-3.5 shrink-0", !direction && "opacity-40")}
        />
      </button>
    </TableHead>
  );
}
