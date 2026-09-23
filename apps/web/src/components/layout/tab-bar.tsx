import { Link, useLocation } from "react-router";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/** 좁은 화면(md 미만) 전용 하단 탭 바. */
export function TabBar() {
  const { pathname } = useLocation();

  return (
    <nav
      data-slot="tab-bar"
      aria-label="주 메뉴"
      className="pb-safe border-border bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid h-18 max-w-[640px] grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:bg-muted flex h-full flex-col items-center justify-center gap-0.5 text-sm font-semibold transition-colors outline-none",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
