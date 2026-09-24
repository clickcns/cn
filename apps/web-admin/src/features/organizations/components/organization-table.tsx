import { PROGRAM_LABELS, type Organization } from "@repo/shared-types";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  sortRows,
  useTableSort,
  type SortValues,
} from "@/hooks/use-table-sort";
import { formatDate, orDash } from "@/lib/format";

const SORT_VALUES = {
  name: (organization) => organization.name,
  code: (organization) => organization.code,
  userCount: (organization) => organization.userCount,
  recipientCount: (organization) => organization.recipientCount,
  createdAt: (organization) => organization.createdAt,
} satisfies SortValues<Organization>;
type OrganizationSortKey = keyof typeof SORT_VALUES;

interface OrganizationTableProps {
  organizations: Organization[];
  onEdit: (organization: Organization) => void;
}

export function OrganizationTable({
  organizations,
  onEdit,
}: OrganizationTableProps) {
  const sorting = useTableSort<OrganizationSortKey>();
  const head = (
    key: OrganizationSortKey,
    label: string,
    className?: string,
  ) => (
    <SortableTableHead sortKey={key} sorting={sorting} className={className}>
      {label}
    </SortableTableHead>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {head("name", "기관 이름")}
          {head("code", "기관 코드")}
          <TableHead>사업</TableHead>
          {head("userCount", "사용자 수", "text-right")}
          {head("recipientCount", "수급자 수", "text-right")}
          {head("createdAt", "등록일")}
          <TableHead className="w-0 text-right">
            <span className="sr-only">관리</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortRows(organizations, sorting.sort, SORT_VALUES).map(
          (organization) => (
            <TableRow key={organization.id}>
              <TableCell className="font-medium">{organization.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {orDash(organization.code)}
              </TableCell>
              <TableCell>
                {orDash(
                  organization.programs
                    .map((program) => PROGRAM_LABELS[program])
                    .join(", "),
                )}
              </TableCell>
              <TableCell className="text-right">
                {organization.userCount.toLocaleString("ko-KR")}명
              </TableCell>
              <TableCell className="text-right">
                {organization.recipientCount.toLocaleString("ko-KR")}명
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(organization.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(organization)}
                >
                  <PencilIcon />
                  수정
                </Button>
              </TableCell>
            </TableRow>
          ),
        )}
      </TableBody>
    </Table>
  );
}
