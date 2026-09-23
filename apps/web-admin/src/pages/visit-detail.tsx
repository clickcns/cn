import {
  canDeleteVisit,
  PROGRAM_LABELS,
  staffDisplayName,
} from "@repo/shared-types";
import { ArrowLeftIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { useOrganizationColumnNames } from "@/features/organizations/hooks/use-organization-scope";
import { DeleteVisitButton } from "@/features/visits/components/delete-visit-button";
import {
  RecipientInfoCard,
  VisitInfoCard,
} from "@/features/visits/components/visit-info-cards";
import { VisitRecordView } from "@/features/visits/components/visit-record-view";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import { useVisitListHref } from "@/features/visits/hooks/use-visit-list-href";
import { useVisit } from "@/features/visits/hooks/use-visits";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

function BackLink() {
  const listHref = useVisitListHref();
  return (
    <Link
      to={listHref}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[13px] font-medium"
    >
      <ArrowLeftIcon className="size-3.5" />
      방문 기록
    </Link>
  );
}

export default function VisitDetailPage() {
  const { id = "" } = useParams();
  const visitQuery = useVisit(id);
  const organizationNames = useOrganizationColumnNames();

  if (visitQuery.isPending) {
    return (
      <>
        <PageHeader title="방문 상세" eyebrow={<BackLink />} />
        <Card>
          <LoadingState message="방문 기록을 불러오는 중입니다…" />
        </Card>
      </>
    );
  }

  if (visitQuery.isError) {
    return (
      <>
        <PageHeader title="방문 상세" eyebrow={<BackLink />} />
        <Card>
          <ErrorState
            error={visitQuery.error}
            title="방문 기록을 불러오지 못했습니다"
            onRetry={() => void visitQuery.refetch()}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to={ROUTES.visits}>목록으로</Link>
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const visit = visitQuery.data;

  return (
    <>
      <PageHeader
        title={`${visit.recipient.name} 방문 기록`}
        eyebrow={<BackLink />}
        titleAccessory={<VisitStatusBadge status={visit.status} />}
        description={`${formatDateTime(visit.scheduledAt)} · ${PROGRAM_LABELS[visit.program]} · 담당 ${staffDisplayName(visit.staff)}`}
        actions={
          canDeleteVisit(visit.status) ? (
            <DeleteVisitButton visit={visit} />
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <VisitRecordView visit={visit} />
        <div className="grid gap-5 xl:sticky xl:top-[calc(var(--header-height)+1.75rem)]">
          <VisitInfoCard
            visit={visit}
            organizationName={organizationNames?.get(visit.organizationId)}
          />
          <RecipientInfoCard recipient={visit.recipient} />
        </div>
      </div>
    </>
  );
}
