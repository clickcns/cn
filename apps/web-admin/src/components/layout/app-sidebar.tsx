import {
  Building2Icon,
  ClipboardListIcon,
  HeartHandshakeIcon,
  LayoutDashboardIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router";
import { useIsAdmin } from "@/features/auth/hooks/use-current-user";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.dashboard, label: "현황판", icon: LayoutDashboardIcon },
  { to: ROUTES.visits, label: "방문 기록", icon: ClipboardListIcon },
  { to: ROUTES.recipients, label: "수급자", icon: HeartHandshakeIcon },
  { to: ROUTES.users, label: "사용자", icon: UsersRoundIcon },
  {
    to: ROUTES.organizations,
    label: "기관",
    icon: Building2Icon,
    adminOnly: true,
  },
];

export function AppSidebar() {
  const isAdmin = useIsAdmin();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="bg-card sticky top-0 flex h-dvh w-(--sidebar-width) shrink-0 flex-col border-r">
      <div className="flex h-(--header-height) shrink-0 items-center gap-2.5 border-b px-5">
        <img src="/favicon.svg" alt="" className="size-7" />
        <span className="text-[15px] font-bold tracking-tight">
          케어노트 관리
        </span>
      </div>
      <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto p-3">
        <ul className="grid gap-0.5">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/25 flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                    isActive &&
                      "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary font-semibold",
                  )
                }
              >
                <item.icon className="size-4.5" aria-hidden />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-muted-foreground border-t px-5 py-3 text-xs">
        방문 의료·간호 기록
      </p>
    </aside>
  );
}
