import type { LucideIcon } from "lucide-react";
import { CalendarDays, CircleUserRound, Users } from "lucide-react";
import { ROUTES } from "@/lib/routes";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** 이 메뉴가 선택된 것으로 볼 경로인지. */
  isActive: (pathname: string) => boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: ROUTES.VISITS,
    label: "방문",
    icon: CalendarDays,
    isActive: (pathname) =>
      pathname === ROUTES.VISITS || pathname.startsWith("/visits"),
  },
  {
    to: ROUTES.RECIPIENTS,
    label: "수급자",
    icon: Users,
    isActive: (pathname) => pathname.startsWith(ROUTES.RECIPIENTS),
  },
  {
    to: ROUTES.ME,
    label: "내 정보",
    icon: CircleUserRound,
    isActive: (pathname) => pathname.startsWith(ROUTES.ME),
  },
];
