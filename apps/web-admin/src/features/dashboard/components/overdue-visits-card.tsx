import {
  addKstDays,
  formatKstDate,
  VISIT_STATUS_LABELS,
  type VisitListResponse,
} from "@repo/shared-types";
import { CircleCheckIcon, ClipboardXIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/data-state";
import {
  DashboardCardHeader,
  MoreLink,
} from "@/features/dashboard/components/dashboard-card";
import { OVERDUE_STATUSES } from "@/features/dashboard/lib/overdue";
import { VisitTable } from "@/features/visits/components/visit-table";
import { visitsHref } from "@/features/visits/lib/visits-href";

/**
 * 어제까지 방문 중 확정하지 않은 방문(예정 그대로·작성 중). 오래된 앞의 몇 건을 방문 표로
 * 보여 주고, 상태별로 방문 목록에서 모두 보는 링크를 둔다.
 */
export function OverdueVisitsCard({
  page,
  error,
  onRetry,
  today,
  organizationNames,
}: {
  /** 목록 첫 페이지(오래된 순서). 받는 중이면 undefined */
  page: VisitListResponse | undefined;
  error: unknown;
  onRetry: () => void;
  today: string;
  /** 운영자가 전체 기관을 볼 때: 다른 목록처럼 기관별로 묶는다. */
  organizationNames: Map<string, string> | undefined;
}) {
  const oldest = page?.items[0];

  return (
    <Card>
      <DashboardCardHeader
        icon={ClipboardXIcon}
        iconClassName="text-warning"
        title="확정 안 된 지난 방문"
        count={page && `${page.total}건`}
        description="어제까지 방문 중 기록을 확정하지 않은 방문입니다. 예정 그대로면 방문하지 않았거나 기록을 쓰지 않은 것입니다."
      />
      {error ? (
        <ErrorState
          error={error}
          title="지난 방문을 불러오지 못했습니다"
          onRetry={onRetry}
        />
      ) : !page ? (
        <LoadingState />
      ) : !oldest ? (
        <EmptyState
          icon={CircleCheckIcon}
          title="확정 안 된 지난 방문이 없습니다"
          description="어제까지의 방문 기록이 모두 확정됐습니다."
          className="py-10"
        />
      ) : (
        <>
          <VisitTable
            visits={page.items}
            organizationNames={organizationNames}
          />
          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm">
            <span>
              {page.total > page.items.length
                ? `오래된 ${page.items.length}건을 보여 줍니다.`
                : `${page.total}건을 모두 보여 줍니다.`}
            </span>
            <span className="flex flex-wrap gap-4">
              {OVERDUE_STATUSES.map(
                (status) =>
                  page.statusCounts[status] > 0 && (
                    <MoreLink
                      key={status}
                      to={visitsHref({
                        from: formatKstDate(new Date(oldest.scheduledAt)),
                        to: addKstDays(today, -1),
                        status,
                      })}
                    >
                      {VISIT_STATUS_LABELS[status]} {page.statusCounts[status]}
                      건 모두 보기
                    </MoreLink>
                  ),
              )}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
