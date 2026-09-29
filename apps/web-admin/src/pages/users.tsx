import {
  assignableRoles,
  ROLE_LABELS,
  type Role,
  type UserSummary,
} from "@repo/shared-types";
import { UserPlusIcon, UsersRoundIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/data-state";
import { Label } from "@/components/ui/label";
import { ListCount } from "@/components/ui/list-count";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import {
  useCurrentUser,
  useIsAdmin,
} from "@/features/auth/hooks/use-current-user";
import {
  useScopeOrganizationId,
  useShowsAllOrganizations,
} from "@/features/organizations/hooks/use-organization-scope";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import { EditUserDialog } from "@/features/users/components/edit-user-dialog";
import { ResetPasswordDialog } from "@/features/users/components/reset-password-dialog";
import { UserTable } from "@/features/users/components/user-table";
import { useUsers } from "@/features/users/hooks/use-users";

type UserDialog = "edit" | "password";

export default function UsersPage() {
  const currentUser = useCurrentUser();
  const isAdmin = useIsAdmin();
  const scopeOrganizationId = useScopeOrganizationId();
  const showsAllOrganizations = useShowsAllOrganizations();
  const [role, setRole] = useState<Role | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [dialog, setDialog] = useState<UserDialog | null>(null);
  const [target, setTarget] = useState<UserSummary | null>(null);

  const usersQuery = useUsers({ organizationId: scopeOrganizationId, role });
  const users = usersQuery.data ?? [];
  // 기관 관리자 화면에는 운영자 계정이 나오지 않는다.
  const roleOptions = assignableRoles(currentUser?.role ?? "MANAGER");

  const openDialog = (kind: UserDialog, user: UserSummary) => {
    setTarget(user);
    setDialog(kind);
  };
  const onDialogOpenChange = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <>
      <PageHeader
        title="사용자"
        description={
          isAdmin
            ? "운영자·기관 관리자·현장 직원(의사·간호사·사회복지사) 계정을 관리합니다."
            : "우리 기관의 기관 관리자·현장 직원(의사·간호사·사회복지사) 계정을 관리합니다."
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlusIcon />
            사용자 추가
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="user-filter-role">역할</Label>
              <Select
                id="user-filter-role"
                containerClassName="w-40"
                value={role ?? ""}
                onChange={(event) =>
                  setRole(roleOptions.find((r) => r === event.target.value))
                }
              >
                <option value="">전체 역할</option>
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {usersQuery.isSuccess && (
            <ListCount
              count={users.length}
              unit="명"
              isFetching={usersQuery.isFetching}
              className="pb-2"
            >
              <span>
                · 활성 {users.filter((user) => user.isActive).length}명
              </span>
            </ListCount>
          )}
        </div>

        {usersQuery.isPending ? (
          <LoadingState message="사용자 목록을 불러오는 중입니다…" />
        ) : usersQuery.isError ? (
          <ErrorState
            error={usersQuery.error}
            title="사용자 목록을 불러오지 못했습니다"
            onRetry={() => void usersQuery.refetch()}
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon={UsersRoundIcon}
            title={
              role
                ? `${ROLE_LABELS[role]} 계정이 없습니다`
                : "사용자가 없습니다"
            }
            description="사용자를 추가하면 아이디와 초기 비밀번호로 로그인할 수 있습니다."
            action={
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <UserPlusIcon />
                사용자 추가
              </Button>
            }
          />
        ) : (
          <UserTable
            users={users}
            currentUserId={currentUser?.id}
            grouped={showsAllOrganizations}
            onEdit={(user) => openDialog("edit", user)}
            onResetPassword={(user) => openDialog("password", user)}
          />
        )}
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDialog
        open={dialog === "edit"}
        onOpenChange={onDialogOpenChange}
        user={target}
      />
      <ResetPasswordDialog
        open={dialog === "password"}
        onOpenChange={onDialogOpenChange}
        user={target}
      />
    </>
  );
}
