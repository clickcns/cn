import { ROLE_LABELS } from "@repo/shared-types";
import { Link, useLocation } from "react-router";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useCurrentUser } from "@/features/auth/hooks/use-session";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** 넓은 화면(md 이상) 전용 상단 헤더. 좁은 화면에서는 하단 탭 바를 쓴다. */
export function AppHeader() {
  const { pathname } = useLocation();
  const user = useCurrentUser();

  return (
    <header className="pt-safe border-border bg-card/95 sticky top-0 z-40 hidden border-b backdrop-blur md:block">
      <div className="mx-auto flex h-18 max-w-[1100px] items-center gap-8 px-8">
        <Link
          to={ROUTES.VISITS}
          className="text-primary focus-visible:ring-ring/30 flex items-center gap-2.5 rounded-xl text-xl font-extrabold outline-none focus-visible:ring-4"
        >
          <img src="/icons/icon.svg" alt="" className="size-9" />
          케어노트
        </Link>

        <nav aria-label="주 메뉴">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-visible:ring-ring/30 flex h-12 items-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors outline-none focus-visible:ring-4",
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {user && (
          <div className="ml-auto flex min-w-0 items-baseline gap-2">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="text-muted-foreground shrink-0 text-sm">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
