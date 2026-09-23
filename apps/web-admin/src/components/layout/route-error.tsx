import { TriangleAlertIcon } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
import { HOME_ROUTE } from "@/lib/routes";

/** 화면을 그리다 예기치 못한 오류가 나면 보여 준다. */
export function RouteError() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null;

  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <title>오류 · 케어노트 관리</title>
      <div className="bg-destructive-soft text-destructive flex size-12 items-center justify-center rounded-full">
        <TriangleAlertIcon className="size-6" />
      </div>
      <h1 className="text-xl font-bold">화면을 표시하지 못했습니다</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 알려 주세요.
      </p>
      {detail && (
        <p className="text-muted-foreground max-w-md font-mono text-xs break-all">
          {detail}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          새로고침
        </Button>
        <Button asChild>
          <Link to={HOME_ROUTE}>처음 화면으로</Link>
        </Button>
      </div>
    </div>
  );
}
