import { getErrorMessage } from "@repo/api-client";
import { VISIT_STATUS_LABELS, VISIT_STATUSES } from "@repo/shared-types";
import { CalendarXIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/data-state";
import { ListCount } from "@/components/ui/list-count";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import {
  useOrganizationColumnNames,
  useScopeOrganizationId,
} from "@/features/organizations/hooks/use-organization-scope";
import { CreateVisitDialog } from "@/features/visits/components/create-visit-dialog";
import { VisitFilters } from "@/features/visits/components/visit-filters";
import { VisitTable } from "@/features/visits/components/visit-table";
import { useVisitFilters } from "@/features/visits/hooks/use-visit-filters";
import { useInfiniteVisits } from "@/features/visits/hooks/use-visits";

export default function VisitsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { filters, setFilter, resetFilters, isCustomized } = useVisitFilters();
  const scopeOrganizationId = useScopeOrganizationId();
  const organizationNames = useOrganizationColumnNames();

  const rangeInvalid = filters.from > filters.to;
  const visitsQuery = useInfiniteVisits(
    {
      from: filters.from,
      to: filters.to,
      status: filters.status,
      program: filters.program,
      staffId: filters.staffId,
      organizationId: scopeOrganizationId,
    },
    { enabled: !rangeInvalid },
  );
  const list = visitsQuery.data;
  // "더 보기"만 실패했으면 이미 받은 목록은 그대로 두고 표 아래에 알린다.
  const listError = visitsQuery.isError && !visitsQuery.isFetchNextPageError;
  const canFetchMore =
    visitsQuery.hasNextPage && !visitsQuery.isPlaceholderData;

  return (
    <>
      <PageHeader
        title="방문 기록"
        description="방문 일정과 담당자가 작성한 기록을 확인합니다. 행을 누르면 상세 기록을 볼 수 있습니다."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            방문 등록
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b px-5 py-4">
          <VisitFilters
            filters={filters}
            onChange={setFilter}
            onReset={resetFilters}
            canReset={isCustomized}
          />
          {list && !rangeInvalid && !listError && (
            // 건수는 받은 목록이 아니라 서버가 준 조건 전체 기준(첫 페이지 응답)이다.
            <ListCount
              count={list.total}
              unit="건"
              isFetching={
                visitsQuery.isFetching && !visitsQuery.isFetchingNextPage
              }
              className="pb-2"
            >
              {VISIT_STATUSES.map((status) => (
                <span key={status}>
                  · {VISIT_STATUS_LABELS[status]} {list.statusCounts[status]}
                </span>
              ))}
            </ListCount>
          )}
        </div>

        {rangeInvalid ? (
          <EmptyState
            icon={CalendarXIcon}
            title="기간을 확인해 주세요"
            description="시작일이 종료일보다 늦습니다."
          />
        ) : listError ? (
          <ErrorState
            error={visitsQuery.error}
            title="방문 목록을 불러오지 못했습니다"
            onRetry={() => void visitsQuery.refetch()}
          />
        ) : !list ? (
          <LoadingState message="방문 목록을 불러오는 중입니다…" />
        ) : list.items.length === 0 ? (
          <EmptyState
            icon={CalendarXIcon}
            title="조건에 맞는 방문이 없습니다"
            description="기간·상태·사업·담당자 조건을 바꾸거나 새 방문을 등록해 보세요."
            action={
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <PlusIcon />
                방문 등록
              </Button>
            }
          />
        ) : (
          <>
            <VisitTable
              visits={list.items}
              organizationNames={organizationNames}
            />
            <div className="flex flex-col items-center gap-2 border-t px-5 py-4">
              {canFetchMore && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={visitsQuery.isFetchingNextPage}
                  onClick={() => void visitsQuery.fetchNextPage()}
                >
                  {visitsQuery.isFetchingNextPage && <Spinner />}더 보기
                </Button>
              )}
              {visitsQuery.isFetchNextPageError &&
                !visitsQuery.isFetchingNextPage && (
                  <p role="alert" className="text-destructive text-[13px]">
                    {getErrorMessage(visitsQuery.error)}
                  </p>
                )}
              <p className="text-muted-foreground text-[13px] tabular-nums">
                전체 {list.total}건 중 {list.items.length}건 표시
              </p>
            </div>
          </>
        )}
      </Card>

      <CreateVisitDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
