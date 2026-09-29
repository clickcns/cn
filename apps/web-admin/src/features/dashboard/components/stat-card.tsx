import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { MoreLink } from "@/features/dashboard/components/dashboard-card";
import { cn } from "@/lib/utils";

/** 현황판 맨 위의 숫자 한 칸. value가 undefined면(받는 중·받지 못함) "—"를 보여 준다. */
export function StatCard({
  label,
  icon: Icon,
  value,
  unit,
  detail,
  tone = "default",
  link,
}: {
  label: string;
  icon: LucideIcon;
  value: number | undefined;
  unit: string;
  detail?: ReactNode;
  /** warning: 확인할 것이 있음, success: 모두 채움 */
  tone?: "default" | "warning" | "success";
  link?: { to: string; label: string };
}) {
  return (
    <Card className="flex flex-col gap-1.5 p-5">
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm font-medium">
        {label}
        <Icon className="size-4" aria-hidden />
      </div>
      <p className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-3xl font-bold tabular-nums",
            value !== undefined && tone === "warning" && "text-warning",
            value !== undefined && tone === "success" && "text-success",
          )}
        >
          {value ?? "—"}
        </span>
        {value !== undefined && (
          <span className="text-muted-foreground text-sm">{unit}</span>
        )}
      </p>
      <div className="text-muted-foreground min-h-5 text-xs tabular-nums">
        {detail}
      </div>
      {link && (
        <div className="mt-1">
          <MoreLink to={link.to}>{link.label}</MoreLink>
        </div>
      )}
    </Card>
  );
}
