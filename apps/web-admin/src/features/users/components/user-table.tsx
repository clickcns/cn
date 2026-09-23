import { PROFESSION_LABELS, type UserSummary } from "@repo/shared-types";
import { KeyRoundIcon, PencilIcon } from "lucide-react";
import { ActiveBadge } from "@/components/active-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleBadge } from "@/features/users/components/role-badge";
import { formatDate, orDash } from "@/lib/format";
import { cn } from "@/lib/utils";

interface UserTableProps {
  users: UserSummary[];
  currentUserId: string | undefined;
  onEdit: (user: UserSummary) => void;
  onResetPassword: (user: UserSummary) => void;
}

export function UserTable({
  users,
  currentUserId,
  onEdit,
  onResetPassword,
}: UserTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>아이디</TableHead>
          <TableHead>이름</TableHead>
          <TableHead>역할</TableHead>
          <TableHead>직종</TableHead>
          <TableHead>기관</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>생성일</TableHead>
          <TableHead className="w-0 text-right">
            <span className="sr-only">관리</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow
            key={user.id}
            className={cn(!user.isActive && "text-muted-foreground")}
          >
            <TableCell className="font-mono text-[13px]">
              {user.username}
            </TableCell>
            <TableCell className="font-medium">
              <span className="inline-flex items-center gap-1.5">
                {user.name}
                {user.id === currentUserId && (
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
            <TableCell>{orDash(user.organizationName)}</TableCell>
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
        ))}
      </TableBody>
    </Table>
  );
}
