import type { VisitDetail } from "@repo/shared-types";
import type { ReactNode } from "react";
import { PageError, PageLoading } from "@/components/ui/page-state";
import { useVisit } from "@/features/visits/hooks/use-visits";

/**
 * 방문 상세를 받은 뒤에만 그리는 자리(받는 중·실패 표시 포함). 목록에 없는 정보(보호자 번호 등)가 필요한
 * 창 안에서, 열었을 때만 받으려고 쓴다.
 */
export function VisitDetailGate({
  visitId,
  children,
}: {
  visitId: string;
  children: (visit: VisitDetail) => ReactNode;
}) {
  const visitQuery = useVisit(visitId);
  if (visitQuery.isPending) return <PageLoading className="py-8" />;
  if (visitQuery.isError) {
    return (
      <PageError
        error={visitQuery.error}
        fallback="방문 정보를 불러오지 못했습니다"
        onRetry={() => void visitQuery.refetch()}
      />
    );
  }
  return children(visitQuery.data);
}
