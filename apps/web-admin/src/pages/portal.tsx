import {
  formatDateLabel,
  isFormId,
  type FormId,
  type PortalQueueItem,
} from "@repo/shared-types";
import { ClipboardCheckIcon, InboxIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  useOrganizationColumnNames,
  useScopeOrganizationId,
} from "@/features/organizations/hooks/use-organization-scope";
import { PortalHelper } from "@/features/portal/components/portal-helper";
import { PortalQueueList } from "@/features/portal/components/portal-queue-list";
import {
  usePortalEntries,
  usePortalQueue,
} from "@/features/portal/hooks/use-portal";
import { useVisit } from "@/features/visits/hooks/use-visits";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";

/**
 * 포털 입력: 확정했지만 심평원·공단에 넣었다고 표시하지 않은 서식(왼쪽)과, 고른 서식을 포털 화면
 * 순서대로 늘어놓은 입력 도우미(오른쪽). 고른 서식은 주소(?visit=&form=)에 둔다. 서식마다 한 번
 * [입력 완료]를 누르면 목록에서 빠지고 다음 서식이 열린다.
 */
export default function PortalPage() {
  const organizationId = useScopeOrganizationId();
  // 운영자가 "전체 기관"을 볼 때만 있다. 목록 줄에 기관 이름을 붙인다.
  const organizationNames = useOrganizationColumnNames();
  const [searchParams] = useSearchParams();
  const updateSearch = useSearchParamsUpdater();
  const queueQuery = usePortalQueue({ organizationId });
  const queue = queueQuery.data;
  const items = queue?.items ?? [];

  const visitParam = searchParams.get("visit");
  const formParam = searchParams.get("form");
  // 주소로 고른 서식, 없으면 목록의 첫 서식
  const selected =
    visitParam && isFormId(formParam)
      ? { visitId: visitParam, formId: formParam }
      : items[0]
        ? { visitId: items[0].visitId, formId: items[0].formId }
        : null;

  const select = (item: PortalQueueItem | undefined) =>
    updateSearch({ visit: item?.visitId, form: item?.formId });
  // 입력 완료 뒤: 목록에서 지금 서식 다음(없으면 앞) 서식으로
  const selectNext = () => {
    const index = items.findIndex(
      (item) =>
        item.visitId === selected?.visitId && item.formId === selected.formId,
    );
    select(index < 0 ? items[0] : (items[index + 1] ?? items[index - 1]));
  };

  return (
    <>
      <PageHeader
        title="포털 입력"
        description="확정한 기록을 심평원·공단 화면 순서대로 늘어놓습니다. 포털에서 표시된 항목만 체크하고 글·숫자는 [복사]해 붙여 넣은 뒤, 서식마다 한 번 [입력 완료]를 누르세요. 케어노트는 인증서를 쓰지 않습니다."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-[15px] font-semibold">
              포털에 아직 안 넣은 서식{" "}
              {queue && (
                <span className="text-muted-foreground font-normal tabular-nums">
                  {items.length}건
                </span>
              )}
            </h2>
            {queue && (
              <p className="text-muted-foreground text-xs">
                {formatDateLabel(queue.from)} ~ {formatDateLabel(queue.to)} 방문
                중 확정한 기록
              </p>
            )}
          </div>
          {queueQuery.isPending ? (
            <LoadingState className="py-10" />
          ) : queueQuery.isError ? (
            <ErrorState
              error={queueQuery.error}
              title="목록을 불러오지 못했습니다"
              onRetry={() => void queueQuery.refetch()}
              className="py-10"
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={ClipboardCheckIcon}
              title="포털에 넣을 서식이 없습니다"
              description="이 기간에 확정한 기록을 모두 입력 완료로 표시했습니다."
              className="py-10"
            />
          ) : (
            <PortalQueueList
              items={items}
              selected={selected}
              onSelect={select}
              organizationNames={organizationNames}
            />
          )}
          {queue?.truncated && (
            <p className="text-warning border-t px-4 py-2 text-xs">
              확정 방문이 많아 앞의 일부만 보입니다. 화면 위 [기관 선택]에서
              기관을 골라 주세요.
            </p>
          )}
        </Card>

        <SelectedPane
          key={selected ? `${selected.visitId}:${selected.formId}` : ""}
          selected={selected}
          onMarked={selectNext}
        />
      </div>
    </>
  );
}

/** 오른쪽: 고른 서식의 입력 도우미(받는 중·오류·고를 수 없는 서식이면 안내). */
function SelectedPane({
  selected,
  onMarked,
}: {
  selected: { visitId: string; formId: FormId } | null;
  onMarked: () => void;
}) {
  const visitQuery = useVisit(selected?.visitId);
  const entriesQuery = usePortalEntries(selected?.visitId);

  if (!selected) {
    return (
      <Card>
        <EmptyState
          icon={InboxIcon}
          title="고른 서식이 없습니다"
          description="왼쪽 목록에서 옮겨 적을 서식을 고르세요."
        />
      </Card>
    );
  }
  if (visitQuery.isError || entriesQuery.isError) {
    return (
      <Card>
        <ErrorState
          error={visitQuery.error ?? entriesQuery.error}
          title="방문을 불러오지 못했습니다"
          onRetry={() => {
            void visitQuery.refetch();
            void entriesQuery.refetch();
          }}
        />
      </Card>
    );
  }
  const visit = visitQuery.data;
  const entries = entriesQuery.data;
  if (!visit || !entries) {
    return (
      <Card>
        <LoadingState />
      </Card>
    );
  }
  // 목록은 확정한 방문의 서식만 주므로, 주소를 손으로 바꿨거나 그사이 [수정]으로 되돌린 경우다.
  if (
    visit.status !== "CONFIRMED" ||
    !visit.formIds.includes(selected.formId)
  ) {
    return (
      <Card>
        <EmptyState
          icon={InboxIcon}
          title="옮겨 적을 수 없는 서식입니다"
          description="확정한 기록의 서식만 옮겨 적습니다. 담당자가 [수정]으로 되돌렸다면 다시 확정한 뒤 여세요."
        />
      </Card>
    );
  }
  return (
    <PortalHelper
      visit={visit}
      formId={selected.formId}
      entry={entries.find((entry) => entry.formId === selected.formId)}
      onMarked={onMarked}
    />
  );
}
