import { CircleAlert } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

/**
 * 화면을 그리다 예기치 못한 오류가 나면 보여 준다.
 * 화면별로 나눠 받는 코드를 못 받은 경우(오프라인·새 버전 배포 직후)도 여기로 온다.
 */
export function RouteError() {
  return (
    <div
      role="alert"
      className="bg-background flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <CircleAlert className="text-destructive size-10" />
      <h1 className="text-xl font-bold">화면을 표시하지 못했습니다</h1>
      <p className="text-muted-foreground max-w-sm">
        인터넷 연결을 확인한 뒤 새로고침해 주세요. 작성 중이던 기록은 임시
        저장한 곳까지 남아 있습니다.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          새로고침
        </Button>
        <Button asChild>
          <Link to={ROUTES.VISITS}>방문 목록으로</Link>
        </Button>
      </div>
    </div>
  );
}
