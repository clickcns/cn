import {
  CARE_GRADES,
  GENDERS,
  PROGRAM_SHORT_LABELS,
  type Recipient,
} from "@repo/shared-types";
import { PencilIcon } from "lucide-react";
import { ActiveBadge } from "@/components/active-badge";
import { Badge } from "@/components/ui/badge";
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
import { OrganizationGroupedRows } from "@/features/organizations/components/organization-grouped-rows";
import {
  sortRows,
  useTableSort,
  type SortValues,
} from "@/hooks/use-table-sort";
import {
  formatActiveCount,
  formatBirthDate,
  formatCareGrade,
  formatGender,
  orDash,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const COLUMN_COUNT = 9;

const SORT_VALUES = {
  name: (recipient) => recipient.name,
  // 등급·성별은 정해진 순서(1등급 → 인지지원등급)로
  careGrade: (recipient) =>
    recipient.careGrade ? CARE_GRADES.indexOf(recipient.careGrade) : null,
  gender: (recipient) =>
    recipient.gender ? GENDERS.indexOf(recipient.gender) : null,
  birthDate: (recipient) => recipient.birthDate,
  status: (recipient) => (recipient.isActive ? 0 : 1),
} satisfies SortValues<Recipient>;
type RecipientSortKey = keyof typeof SORT_VALUES;

interface RecipientTableProps {
  recipients: Recipient[];
  /** 운영자가 전체 기관을 볼 때 준다. 수급자를 기관별로 묶고 묶음 이름으로 쓴다. */
  organizationNames?: Map<string, string>;
  onEdit: (recipient: Recipient) => void;
}

export function RecipientTable({
  recipients,
  organizationNames,
  onEdit,
}: RecipientTableProps) {
  const sorting = useTableSort<RecipientSortKey>();
  const sorted = sortRows(recipients, sorting.sort, SORT_VALUES);
  const head = (key: RecipientSortKey, label: string) => (
    <SortableTableHead sortKey={key} sorting={sorting}>
      {label}
    </SortableTableHead>
  );
  const renderRow = (recipient: Recipient) => (
    <RecipientRow key={recipient.id} recipient={recipient} onEdit={onEdit} />
  );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {head("name", "이름")}
          {head("careGrade", "등급")}
          <TableHead>등록 사업</TableHead>
          {head("gender", "성별")}
          {head("birthDate", "생년월일")}
          <TableHead>연락처</TableHead>
          <TableHead>보호자</TableHead>
          {head("status", "상태")}
          <TableHead className="w-0 text-right">
            <span className="sr-only">관리</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {organizationNames ? (
          <OrganizationGroupedRows
            rows={sorted}
            groupOf={(recipient) => ({
              key: recipient.organizationId,
              label: organizationNames.get(recipient.organizationId) ?? "기관",
            })}
            colSpan={COLUMN_COUNT}
            renderRow={renderRow}
            detail={formatActiveCount}
          />
        ) : (
          sorted.map(renderRow)
        )}
      </TableBody>
    </Table>
  );
}

function RecipientRow({
  recipient,
  onEdit,
}: {
  recipient: Recipient;
  onEdit: (recipient: Recipient) => void;
}) {
  return (
    <TableRow className={cn(!recipient.isActive && "text-muted-foreground")}>
      <TableCell className="font-medium">{recipient.name}</TableCell>
      <TableCell className="whitespace-nowrap">
        {formatCareGrade(recipient.careGrade)}
      </TableCell>
      <TableCell>
        {recipient.programs.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {recipient.programs.map((program) => (
              <Badge key={program} variant="outline">
                {PROGRAM_SHORT_LABELS[program]}
              </Badge>
            ))}
          </div>
        ) : (
          // 등록 사업이 없으면 방문을 만들 수 없다.
          <Badge variant="warning">미등록</Badge>
        )}
      </TableCell>
      <TableCell>{formatGender(recipient.gender)}</TableCell>
      <TableCell className="whitespace-nowrap">
        {formatBirthDate(recipient.birthDate)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {orDash(recipient.phone)}
      </TableCell>
      <TableCell>
        {recipient.guardianName || recipient.guardianPhone ? (
          <div className="grid leading-tight">
            <span>{orDash(recipient.guardianName)}</span>
            {recipient.guardianPhone && (
              <span className="text-muted-foreground text-[13px] whitespace-nowrap">
                {recipient.guardianPhone}
              </span>
            )}
          </div>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <ActiveBadge isActive={recipient.isActive} />
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={() => onEdit(recipient)}>
          <PencilIcon />
          수정
        </Button>
      </TableCell>
    </TableRow>
  );
}
