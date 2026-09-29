import { Building2Icon } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/data-state";

/**
 * 이달 방문 목록을 아직 쓸 수 없을 때의 자리: 받지 못함, 방문이 너무 많아 목록 없이 건수만
 * 받음(운영자의 전체 기관 보기), 받는 중.
 */
export function MonthFallback({
  tooMany,
  error,
  onRetry,
}: {
  tooMany: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <ErrorState
        error={error}
        title="이달 방문을 불러오지 못했습니다"
        onRetry={onRetry}
        className="py-10"
      />
    );
  }
  if (tooMany) {
    return (
      <EmptyState
        icon={Building2Icon}
        title="방문이 많아 여기서는 보여 줄 수 없습니다"
        description="위의 기관 선택에서 기관을 골라 주세요."
        className="py-10"
      />
    );
  }
  return <LoadingState className="py-10" />;
}
