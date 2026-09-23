import { ROLE_LABELS } from "@repo/shared-types";
import { LogOutIcon } from "lucide-react";
import { OrganizationScope } from "@/components/layout/organization-scope";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useLogout } from "@/features/auth/hooks/use-logout";

export function AppHeader() {
  const user = useCurrentUser();
  const logout = useLogout();

  return (
    <header className="bg-card/95 sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center justify-between gap-4 border-b px-8 backdrop-blur">
      <OrganizationScope />
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-primary-soft text-primary flex size-8 items-center justify-center rounded-full text-[13px] font-semibold">
              {user.name.slice(0, 1)}
            </span>
            <span className="font-semibold">{user.name}</span>
            <span className="text-muted-foreground">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        )}
        <div className="bg-border h-5 w-px" aria-hidden />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="text-muted-foreground"
        >
          {logout.isPending ? <Spinner /> : <LogOutIcon />}
          로그아웃
        </Button>
      </div>
    </header>
  );
}
