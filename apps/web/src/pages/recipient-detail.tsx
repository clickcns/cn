import { addKstDays, formatKstDate } from "@repo/shared-types";
import { CalendarPlus, History } from "lucide-react";
import { Link, useParams } from "react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageError, PageLoading } from "@/components/ui/page-state";
import { RecipientInfoCard } from "@/features/recipients/components/recipient-info-card";
import { useRecipient } from "@/features/recipients/hooks/use-recipients";
import { RecipientVisitItem } from "@/features/visits/components/recipient-visit-item";
import { useRecipientVisits } from "@/features/visits/hooks/use-visits";
import { newVisitPath, ROUTES } from "@/lib/routes";

const RECENT_DAYS = 90;

function RecentVisits({ recipientId }: { recipientId: string }) {
  const today = formatKstDate();
  const visitsQuery = useRecipientVisits(
    recipientId,
    addKstDays(today, -(RECENT_DAYS - 1)),
    today,
  );
  // 최근 방문이 위로 오게 한다(서버는 오래된 순).
  const visits = [...(visitsQuery.data?.items ?? [])].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>최근 {RECENT_DAYS}일 방문</CardTitle>
      </CardHeader>
      {visitsQuery.isPending ? (
        <PageLoading className="py-8" />
      ) : visitsQuery.isError ? (
        <PageError
          error={visitsQuery.error}
          fallback="방문 이력을 불러오지 못했습니다"
          onRetry={() => void visitsQuery.refetch()}
        />
      ) : visits.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="최근 방문 기록이 없습니다"
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visits.map((visit) => (
            <li key={visit.id}>
              <RecipientVisitItem visit={visit} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function RecipientDetailPage() {
  const { recipientId = "" } = useParams();
  const recipientQuery = useRecipient(recipientId);

  if (recipientQuery.isPending || recipientQuery.isError) {
    return (
      <>
        <PageHeader title="수급자 정보" backTo={ROUTES.RECIPIENTS} />
        {recipientQuery.isPending ? (
          <PageLoading />
        ) : (
          <PageError
            error={recipientQuery.error}
            fallback="수급자 정보를 불러오지 못했습니다"
            onRetry={() => void recipientQuery.refetch()}
          />
        )}
      </>
    );
  }

  const recipient = recipientQuery.data;

  return (
    <>
      <PageHeader title="수급자 정보" backTo={ROUTES.RECIPIENTS} />

      <div className="flex flex-col gap-4 md:grid md:grid-cols-[17.5rem_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 md:sticky md:top-24">
          <RecipientInfoCard recipient={recipient} />
          <Button asChild variant="soft" size="lg" className="w-full">
            <Link to={newVisitPath({ recipientId: recipient.id })}>
              <CalendarPlus />
              방문 추가
            </Link>
          </Button>
        </aside>

        <RecentVisits recipientId={recipient.id} />
      </div>
    </>
  );
}
