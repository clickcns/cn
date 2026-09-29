import { getErrorMessage } from "@repo/api-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { useInfiniteVisits } from "@/features/visits/hooks/use-visits";

/**
 * "더 보기"로 이어 받는 방문 목록의 아래 줄: [더 보기], 이어 받기 실패 알림,
 * showCount면 받은 건수. 목록 보기와 달력의 고른 날 표가 함께 쓴다.
 */
export function VisitListFooter({
  query,
  showCount = false,
}: {
  query: ReturnType<typeof useInfiniteVisits>;
  showCount?: boolean;
}) {
  const list = query.data;
  // 이전 조건의 목록을 임시로 보여 주는 동안에는 이어 받지 않는다.
  const canFetchMore = query.hasNextPage && !query.isPlaceholderData;
  const fetchMoreError =
    query.isFetchNextPageError && !query.isFetchingNextPage;
  if (!list || (!canFetchMore && !fetchMoreError && !showCount)) return null;

  return (
    <div className="flex flex-col items-center gap-2 border-t px-5 py-4">
      {canFetchMore && (
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage && <Spinner />}더 보기
        </Button>
      )}
      {fetchMoreError && (
        <p role="alert" className="text-destructive text-[13px]">
          {getErrorMessage(query.error)}
        </p>
      )}
      {showCount && (
        <p className="text-muted-foreground text-[13px] tabular-nums">
          전체 {list.total}건 중 {list.items.length}건 표시
        </p>
      )}
    </div>
  );
}
