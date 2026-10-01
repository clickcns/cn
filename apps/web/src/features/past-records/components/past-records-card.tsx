import { useState } from "react";
import { FORMS, type FormId, type RecipientRecord } from "@repo/shared-types";
import { ChevronRight, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState, PageError, PageLoading } from "@/components/ui/page-state";
import { usePastRecordParam } from "@/features/past-records/hooks/use-past-record-param";
import {
  usePastRecords,
  type PastRecordsAnchor,
} from "@/features/past-records/hooks/use-past-records";
import {
  recordDateLabel,
  recordStaffLabel,
} from "@/features/past-records/lib/record-labels";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import { useMediaQuery } from "@/hooks/use-media-query";

/** 처음 보여 주는 기록 수(좁은 화면·넓은 화면)와 [더 보기]로 늘리는 수. */
const FIRST_NARROW = 1;
const FIRST_WIDE = 3;
const MORE = 5;

/** "별지 제4호" → "제4호" */
const shortCode = (formId: FormId) => FORMS[formId].code.replace("별지 ", "");

function PastRecordRow({
  record,
  sharedFormIds,
  onOpen,
}: {
  record: RecipientRecord;
  /** 이번 방문에도 있는 서식(불러올 수 있는 서식)을 강조한다 */
  sharedFormIds: readonly FormId[];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring/30 active:bg-muted flex min-h-18 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-4"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums">
            {recordDateLabel(record)}
          </span>
          {record.status === "DRAFT" && (
            <VisitStatusBadge status="DRAFT" size="sm" />
          )}
        </span>
        <span className="text-muted-foreground text-sm">
          {recordStaffLabel(record)}
        </span>
        <span className="flex flex-wrap gap-1">
          {record.formIds.map((formId) => (
            <Badge
              key={formId}
              size="sm"
              variant={sharedFormIds.includes(formId) ? "primary" : "neutral"}
            >
              {shortCode(formId)}
            </Badge>
          ))}
        </span>
      </span>
      <ChevronRight className="text-muted-foreground size-5 shrink-0" />
    </button>
  );
}

/**
 * 기록 화면 옆(좁은 화면은 서식 위)의 지난 기록: 같은 수급자의 이 방문 전 기록(같은 기관 확정 기록과
 * 내 작성 중 기록)을 최신순으로 보여 주고, 누르면 기록 보기 창(?past=)을 연다.
 */
export function PastRecordsCard({ visit }: { visit: PastRecordsAnchor }) {
  const recordsQuery = usePastRecords(visit);
  const { open } = usePastRecordParam();
  const isWide = useMediaQuery("(min-width: 48rem)");
  const [extra, setExtra] = useState(0);
  const records = recordsQuery.data ?? [];
  const shown = (isWide ? FIRST_WIDE : FIRST_NARROW) + extra;
  const hasMore = records.length > shown || recordsQuery.hasNextPage;

  const showMore = () => {
    setExtra(extra + MORE);
    if (records.length < shown + MORE && recordsQuery.hasNextPage) {
      void recordsQuery.fetchNextPage();
    }
  };

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="text-primary size-5" />
          지난 기록
        </CardTitle>
        <CardDescription>
          같은 기관에서 확정한 기록과 내 작성 중 기록
        </CardDescription>
      </CardHeader>
      {recordsQuery.isPending ? (
        <PageLoading className="py-6" />
      ) : recordsQuery.isError ? (
        <PageError
          error={recordsQuery.error}
          fallback="지난 기록을 불러오지 못했습니다"
          onRetry={() => void recordsQuery.refetch()}
          className="py-6"
        />
      ) : records.length === 0 ? (
        <EmptyState title="지난 기록이 없습니다" className="py-6" />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {records.slice(0, shown).map((record) => (
              <li key={record.id}>
                <PastRecordRow
                  record={record}
                  sharedFormIds={visit.formIds}
                  onOpen={() => open(record.id)}
                />
              </li>
            ))}
          </ul>
          {hasMore && (
            <Button
              variant="ghost"
              onClick={showMore}
              disabled={recordsQuery.isFetchingNextPage}
            >
              더 보기
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
