import { getErrorMessage } from "@repo/api-client";
import { CircleAlertIcon, InboxIcon, type LucideIcon } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function LoadingState({
  message = "불러오는 중입니다…",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm",
        className,
      )}
    >
      <Spinner />
      {message}
    </div>
  );
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground mb-1 flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground max-w-md text-sm">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  title = "목록을 불러오지 못했습니다",
  onRetry,
  action,
  className,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="bg-destructive-soft text-destructive mb-1 flex size-11 items-center justify-center rounded-full">
        <CircleAlertIcon className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground max-w-md text-sm">
        {getErrorMessage(error)}
      </p>
      {(onRetry || action) && (
        <div className="mt-2 flex gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
