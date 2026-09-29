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
import { OrganizationScopeFilter } from "@/features/organizations/components/organization-scope-select";
import {
  useOrganizationColumnNames,
  useScopeOrganizationId,
} from "@/features/organizations/hooks/use-organization-scope";
import {
  CreateVisitDialog,
  type CreateVisitDefaults,
} from "@/features/visits/components/create-visit-dialog";
import { VisitCalendarView } from "@/features/visits/components/visit-calendar-view";
import { VisitFilters } from "@/features/visits/components/visit-filters";
import { VisitListFooter } from "@/features/visits/components/visit-list-footer";
import { VisitTable } from "@/features/visits/components/visit-table";
import { VisitViewToggle } from "@/features/visits/components/visit-view-toggle";
import {
  useVisitFilters,
  visitConditions,
} from "@/features/visits/hooks/use-visit-filters";
import { useVisitView } from "@/features/visits/hooks/use-visit-view";
import { useInfiniteVisits } from "@/features/visits/hooks/use-visits";

export default function VisitsPage() {
  // 등록 창이 열려 있으면 기본값(달력에서 고른 날·수급자, 복사한 방문)을 든다.
  const [create, setCreate] = useState<CreateVisitDefaults | null>(null);
  const { filters, setFilter, resetFilters, isCustomized } = useVisitFilters();
  const visitView = useVisitView();
  const isCalendar = visitView.view === "calendar";
  const scopeOrganizationId = useScopeOrganizationId();
  const organizationNames = useOrganizationColumnNames();

  const rangeInvalid = filters.from > filters.to;
  // 기간 목록은 목록 보기일 때만 받는다(달력은 달력 보기가 따로 받는다).
  const visitsQuery = useInfiniteVisits(
    {
      from: filters.from,
      to: filters.to,
      status: filters.status,
      program: filters.program,
      staffId: filters.staffId,
      organizationId: scopeOrganizationId,
      // 운영자가 전체 기관을 보면 기관별로 묶어 받는다(묶음 머리 줄의 기관별 건수 포함).
      groupBy: organizationNames ? "organization" : undefined,
    },
    { enabled: !rangeInvalid && !isCalendar },
  );
  const list = visitsQuery.data;
  // "더 보기"만 실패했으면 이미 받은 목록은 그대로 두고 표 아래에 알린다.
  const listError = visitsQuery.isError && !visitsQuery.isFetchNextPageError;

  return (
    <>
      <PageHeader
        title="방문 기록"
        description="방문 일정과 담당자가 작성한 기록을 확인합니다. 행을 누르면 상세 기록을 볼 수 있고, 달력에서는 날짜를 눌러 그날 방문을 봅니다."
        actions={
          <Button onClick={() => setCreate({})}>
            <PlusIcon />
            방문 등록
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <VisitViewToggle
              value={visitView.view}
              onChange={visitView.setView}
            />
            {/* 운영자만: 헤더 [기관 선택]과 같은 값 */}
            <OrganizationScopeFilter id="visit-filter-organization" />
            <VisitFilters
              filters={filters}
              onChange={setFilter}
              onReset={resetFilters}
              canReset={isCustomized}
              showDateRange={!isCalendar}
            />
          </div>
          {!isCalendar && list && !rangeInvalid && !listError && (
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

        {isCalendar ? (
          <VisitCalendarView
            month={visitView.month}
            selectedDay={visitView.selectedDay}
            today={visitView.today}
            conditions={visitConditions(filters)}
            recipientId={visitView.recipientId}
            organizationId={scopeOrganizationId}
            organizationNames={organizationNames}
            onMonthChange={visitView.setMonth}
            onSelectDay={visitView.selectDay}
            onSelectRecipient={visitView.setRecipient}
            onCreate={setCreate}
          />
        ) : rangeInvalid ? (
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
              <Button variant="outline" onClick={() => setCreate({})}>
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
              organizationCounts={list.organizationCounts}
            />
            <VisitListFooter query={visitsQuery} showCount />
          </>
        )}
      </Card>

      <CreateVisitDialog
        open={create !== null}
        onOpenChange={(open) => {
          if (!open) setCreate(null);
        }}
        defaults={create ?? undefined}
      />
    </>
  );
}
