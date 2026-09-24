import {
  PROFESSION_LABELS,
  PROFESSIONS,
  ROLES,
  type UserSummary,
} from "@repo/shared-types";
import { KeyRoundIcon, PencilIcon } from "lucide-react";
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
import { OrganizationGroupedRows } from "@/components/ui/table-groups";
import { RoleBadge } from "@/features/users/components/role-badge";
import {
  sortRows,
  useTableSort,
  type SortValues,
} from "@/hooks/use-table-sort";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLUMN_COUNT = 7;

const SORT_VALUES = {
  username: (user) => user.username,
  name: (user) => user.name,
  // 역할·직종은 가나다순이 아니라 정해진 순서(운영자 → 기관 관리자 → 현장 직원)로
  role: (user) => ROLES.indexOf(user.role),
  profession: (user) =>
    user.profession ? PROFESSIONS.indexOf(user.profession) : null,
  status: (user) => (user.isActive ? 0 : 1),
  createdAt: (user) => user.createdAt,
} satisfies SortValues<UserSummary>;
type UserSortKey = keyof typeof SORT_VALUES;

interface UserTableProps {
  users: UserSummary[];
  currentUserId: string | undefined;
  /** 운영자가 전체 기관을 볼 때 기관별로 묶는다(한 기관만 볼 때는 묶지 않는다). */
  grouped: boolean;
  onEdit: (user: UserSummary) => void;
  onResetPassword: (user: UserSummary) => void;
}

export function UserTable({
  users,
  currentUserId,
  grouped,
  onEdit,
  onResetPassword,
}: UserTableProps) {
  const sorting = useTableSort<UserSortKey>();
  const sorted = sortRows(users, sorting.sort, SORT_VALUES);

  const renderRow = (user: UserSummary) => (
    <UserRow
      key={user.id}
      user={user}
      isCurrentUser={user.id === currentUserId}
      onEdit={onEdit}
      onResetPassword={onResetPassword}
    />
  );

  const head = (key: UserSortKey, label: string) => (
    <SortableTableHead sortKey={key} sorting={sorting}>
      {label}
    </SortableTableHead>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {head("username", "아이디")}
          {head("name", "이름")}
          {head("role", "역할")}
          {head("profession", "직종")}
          {head("status", "상태")}
          {head("createdAt", "생성일")}
          <TableHead className="w-0 text-right">
            <span className="sr-only">관리</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grouped ? (
          <OrganizationGroupedRows
            rows={sorted}
            // 운영자는 기관이 없어 맨 앞 묶음으로 모은다.
            groupOf={(user) => ({
              key: user.organizationId ?? "",
              label: user.organizationName ?? "기관 없음 (운영자)",
            })}
            colSpan={COLUMN_COUNT}
            renderRow={renderRow}
          />
        ) : (
          sorted.map(renderRow)
        )}
      </TableBody>
    </Table>
  );
}

function UserRow({
  user,
  isCurrentUser,
  onEdit,
  onResetPassword,
}: {
  user: UserSummary;
  isCurrentUser: boolean;
  onEdit: (user: UserSummary) => void;
  onResetPassword: (user: UserSummary) => void;
}) {
  return (
    <TableRow className={cn(!user.isActive && "text-muted-foreground")}>
      <TableCell className="font-mono text-[13px]">{user.username}</TableCell>
      <TableCell className="font-medium">
        <span className="inline-flex items-center gap-1.5">
          {user.name}
          {isCurrentUser && (
            <Badge variant="primary" className="h-5 px-1.5 text-[11px]">
              나
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell>
        {user.profession ? (
          <span className="flex flex-col">
            {PROFESSION_LABELS[user.profession]}
            {user.licenseNumber && (
              <span className="text-muted-foreground text-[12px]">
                {user.licenseNumber}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <ActiveBadge isActive={user.isActive} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(user.createdAt)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(user)}>
            <PencilIcon />
            수정
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResetPassword(user)}
          >
            <KeyRoundIcon />
            비밀번호 재설정
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
