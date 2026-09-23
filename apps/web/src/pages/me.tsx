import { useState } from "react";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCurrentUser } from "@/features/auth/hooks/use-session";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { ProfileCard } from "@/features/me/components/profile-card";

export default function MePage() {
  const user = useCurrentUser();
  const logout = useLogout();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <PageHeader title="내 정보" />

      <div className="flex max-w-xl flex-col gap-4">
        {user && <ProfileCard user={user} />}

        <Button
          variant="destructive-outline"
          size="lg"
          className="w-full"
          onClick={() => setConfirmOpen(true)}
          disabled={logout.isPending}
        >
          <LogOut />
          로그아웃
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => logout.mutate()}
        isPending={logout.isPending}
        title="로그아웃할까요?"
        description="다시 사용하려면 아이디와 비밀번호를 입력해야 합니다."
        confirmText="로그아웃"
        variant="destructive"
      />
    </>
  );
}
