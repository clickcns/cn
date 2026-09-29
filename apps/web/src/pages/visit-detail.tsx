import { useState } from "react";
import {
  canDeleteVisit,
  canReopenVisit,
  canWriteRecord,
} from "@repo/shared-types";
import { Navigate, useParams } from "react-router";
import { PageHeader } from "@/components/layout/page-header";
import { PageError, PageLoading } from "@/components/ui/page-state";
import { useCurrentUser } from "@/features/auth/hooks/use-session";
import { RecipientInfoCard } from "@/features/recipients/components/recipient-info-card";
import { DeleteVisitButton } from "@/features/visits/components/delete-visit-button";
import { VisitRecordForm } from "@/features/visits/components/record-form/visit-record-form";
import { VisitRecordView } from "@/features/visits/components/visit-record-view";
import { VisitSummaryCard } from "@/features/visits/components/visit-summary-card";
import { useVisit } from "@/features/visits/hooks/use-visits";
import { getVisitDate } from "@/features/visits/lib/record-form";
import { visitsPath } from "@/lib/routes";

export default function VisitDetailPage() {
  const { visitId = "" } = useParams();
  const visitQuery = useVisit(visitId);
  const currentUserId = useCurrentUser()?.id;
  const [deleted, setDeleted] = useState(false);

  if (visitQuery.isPending || visitQuery.isError) {
    return (
      <>
        <PageHeader title="방문 기록" backTo={visitsPath()} />
        {visitQuery.isPending ? (
          <PageLoading />
        ) : (
          <PageError
            error={visitQuery.error}
            fallback="방문 기록을 불러오지 못했습니다"
            onRetry={() => void visitQuery.refetch()}
          />
        )}
      </>
    );
  }

  const visit = visitQuery.data;

  // 삭제했으면 그날 일정으로 돌아간다. 기록 폼을 먼저 내린 뒤 이동하므로
  // 입력 중이던 내용이 있어도 "저장하지 않은 변경" 확인 창이 뜨지 않는다.
  if (deleted) {
    return <Navigate to={visitsPath(getVisitDate(visit))} replace />;
  }

  return (
    <>
      <PageHeader title="방문 기록" backTo={visitsPath(getVisitDate(visit))} />

      {/* 넓은 화면: 왼쪽 수급자 정보(따라옴) + 오른쪽 기록. 좁은 화면: 세로로 쌓기. */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[17.5rem_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 md:sticky md:top-24 md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto">
          <VisitSummaryCard visit={visit} />
          <RecipientInfoCard recipient={visit.recipient} />
          {canDeleteVisit(visit.status) && (
            <DeleteVisitButton
              visit={visit}
              onDeleted={() => setDeleted(true)}
            />
          )}
        </aside>

        <div className="min-w-0">
          {/* 기록은 담당 간호사 본인만 쓸 수 있다(서버도 같은 규칙). 그 외에는 읽기 전용. */}
          {currentUserId && canWriteRecord(visit, currentUserId) ? (
            <VisitRecordForm key={visit.id} visit={visit} />
          ) : (
            <VisitRecordView
              visit={visit}
              canReopen={
                currentUserId !== undefined &&
                canReopenVisit(visit, currentUserId)
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
