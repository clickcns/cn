import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** 현황판 카드 머리: 아이콘·제목·건수와 한 줄 설명. */
export function DashboardCardHeader({
  icon: Icon,
  iconClassName = "text-primary",
  title,
  count,
  description,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  /** 제목 옆에 흐리게 붙는 건수. 받기 전이면 undefined */
  count?: string;
  description: ReactNode;
}) {
  return (
    <CardHeader className="flex-col items-start gap-1">
      <CardTitle className="flex items-center gap-2">
        <Icon className={cn("size-4", iconClassName)} aria-hidden />
        {title}
        {count && (
          <span className="text-muted-foreground font-normal tabular-nums">
            {count}
          </span>
        )}
      </CardTitle>
      <p className="text-muted-foreground text-xs">{description}</p>
    </CardHeader>
  );
}

/** "… 보기 >" 링크(방문 목록·달력으로 이어 보기). */
export function MoreLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Button variant="link" className="w-fit gap-0.5" asChild>
      <Link to={to}>
        {children}
        <ChevronRightIcon aria-hidden />
      </Link>
    </Button>
  );
}
