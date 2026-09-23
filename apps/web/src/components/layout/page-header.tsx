import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  /**
   * 뒤로 가기 버튼을 보여 준다. 앱 안에서 들어온 경우 이전 화면으로,
   * 주소로 바로 들어온 경우 이 경로로 이동한다.
   */
  backTo?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * 화면 제목 줄. 좁은 화면에서는 위에 붙어 따라오고(sticky),
 * 넓은 화면에서는 상단 헤더가 따로 있으므로 일반 배치다.
 */
export function PageHeader({
  title,
  backTo,
  action,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    if (!backTo) return;
    // key가 "default"면 이 앱 안에서 이동해 온 기록이 없다(새 탭·새로고침 직후).
    if (location.key === "default") {
      navigate(backTo, { replace: true });
    } else {
      navigate(-1);
    }
  };

  return (
    <div
      className={cn(
        "pt-safe bg-background/95 sticky top-0 z-30 -mx-4 mb-4 px-4 backdrop-blur md:static md:mx-0 md:mt-6 md:mb-6 md:bg-transparent md:px-0 md:backdrop-blur-none",
        className,
      )}
    >
      <div className="flex min-h-16 items-center gap-2">
        {backTo && (
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            aria-label="뒤로 가기"
            className="-ml-3 md:-ml-2"
          >
            <ChevronLeft className="size-7" />
          </Button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold md:text-2xl">
          {title}
        </h1>
        {action && <div className="flex shrink-0 items-center">{action}</div>}
      </div>
    </div>
  );
}
