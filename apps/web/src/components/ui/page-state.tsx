import type { ReactNode } from "react";
import { getErrorMessage } from "@repo/api-client";
import { CircleAlert, LoaderCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageLoading({
  label = "불러오는 중…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "text-muted-foreground flex flex-col items-center justify-center gap-3 py-16",
        className,
      )}
    >
      <LoaderCircle className="text-primary size-8 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function PageError({
  error,
  fallback = "정보를 불러오지 못했습니다",
  onRetry,
  className,
}: {
  error: unknown;
  fallback?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/20 bg-destructive-soft flex flex-col items-center gap-4 rounded-2xl border px-5 py-10 text-center",
        className,
      )}
    >
      <CircleAlert className="text-destructive size-9" />
      <p className="text-destructive text-lg font-semibold">
        {getErrorMessage(error, fallback)}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RotateCw />
          다시 시도
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-input bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="bg-primary-soft text-primary flex size-16 items-center justify-center rounded-full [&>svg]:size-8">
          {icon}
        </div>
      )}
      <p className="text-lg font-bold">{title}</p>
      {description && <p className="text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
