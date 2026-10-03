import { getErrorMessage } from "@repo/api-client";
import {
  ACCESS_ACTION_LABELS,
  ACCESS_ACTIONS,
  formatKstDate,
  isIsoDate,
  monthOf,
  type AccessAction,
  type AccessLogQuery,
} from "@repo/shared-types";
import { DownloadIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/data-state";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { ListCount } from "@/components/ui/list-count";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { AccessLogTable } from "@/features/access-logs/components/access-log-table";
import { useAccessLogs } from "@/features/access-logs/hooks/use-access-logs";
import {
  useScopeOrganizationId,
  useShowsAllOrganizations,
} from "@/features/organizations/hooks/use-organization-scope";
import { useUsers } from "@/features/users/hooks/use-users";
import { staffLabel } from "@/features/users/lib/staff-label";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/download-file";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

/** 한 달에 한 번 점검할 때 먼저 보는 것(누르면 그 조건으로 좁힌다). */
const CHECKS: { label: string; action?: AccessAction; failed?: boolean }[] = [
  { label: "로그인 실패", action: "LOGIN_FAILED" },
  { label: "내려받기", action: "DOWNLOAD" },
  { label: "삭제", action: "DELETE" },
  { label: "권한 변경", action: "PERMISSION" },
  { label: "실패한 요청", failed: true },
];

/**
 * 접속기록: 누가 언제 어디서 어떤 수급자 정보를 보고 고쳤는지(개인정보 안전성 확보조치 기준 제8조).
 * 기관 관리자는 자기 기관, 운영자는 헤더에서 고른 기관(전체 기관이면 모두). 조건은 주소에 둔다.
 */
export default function AccessLogsPage() {
  const today = formatKstDate();
  const [params] = useSearchParams();
  const updateSearch = useSearchParamsUpdater();
  const scopeOrganizationId = useScopeOrganizationId();
  const showsAllOrganizations = useShowsAllOrganizations();
  const [exporting, setExporting] = useState(false);

  const fromParam = params.get("from");
  const toParam = params.get("to");
  const from = isIsoDate(fromParam) ? fromParam : `${monthOf(today)}-01`;
  const to = isIsoDate(toParam) ? toParam : today;
  const action = ACCESS_ACTIONS.find((item) => item === params.get("action"));
  const actorId = params.get("actor") ?? undefined;
  const recipientId = params.get("recipient") ?? undefined;
  const failedOnly = params.get("failed") === "1";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const filters: AccessLogQuery = {
    from,
    to,
    action,
    actorId,
    recipientId,
    failedOnly: failedOnly ? "true" : undefined,
    organizationId: scopeOrganizationId,
  };
  const logs = useAccessLogs({ ...filters, page, pageSize: PAGE_SIZE });
  const users = useUsers({ organizationId: scopeOrganizationId }).data ?? [];
  const data = logs.data;
  const recipientName =
    recipientId &&
    data?.items
      .flatMap((entry) => entry.recipients)
      .find((recipient) => recipient.id === recipientId)?.name;

  /** 조건을 바꾸면 첫 쪽부터 */
  const filter = (changes: Record<string, string | undefined>) =>
    updateSearch({ ...changes, page: undefined });

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadFile(await api.accessLogs.export(filters));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const first = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <>
      <PageHeader
        title="접속기록"
        description="누가 언제 어디서 어떤 수급자 정보를 보고 고쳤는지 남긴 기록입니다. 고칠 수 없고 3년 동안 보관합니다. 한 달에 한 번 이상 로그인 실패·내려받기·삭제·권한 변경을 점검하고, 점검한 달의 기록을 내려받아 두세요."
        actions={
          <Button
            variant="outline"
            disabled={exporting}
            onClick={() => void exportCsv()}
          >
            <DownloadIcon />
            CSV 내려받기
          </Button>
        }
      />

      <Card>
        <div className="grid gap-3 border-b px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="access-from">기간</Label>
              <div className="flex items-center gap-2">
                <DateInput
                  id="access-from"
                  containerClassName="w-40"
                  value={from}
                  max={to}
                  onChange={(value) => {
                    if (isIsoDate(value)) filter({ from: value });
                  }}
                />
                <span className="text-muted-foreground">~</span>
                <DateInput
                  id="access-to"
                  aria-label="종료일"
                  containerClassName="w-40"
                  value={to}
                  min={from}
                  onChange={(value) => {
                    if (isIsoDate(value)) filter({ to: value });
                  }}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="access-action">작업</Label>
              <Select
                id="access-action"
                containerClassName="w-36"
                value={action ?? ""}
                onChange={(event) =>
                  filter({ action: event.target.value || undefined })
                }
              >
                <option value="">전체 작업</option>
                {ACCESS_ACTIONS.map((item) => (
                  <option key={item} value={item}>
                    {ACCESS_ACTION_LABELS[item]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="access-actor">사용자</Label>
              <Select
                id="access-actor"
                containerClassName="w-48"
                value={actorId ?? ""}
                onChange={(event) =>
                  filter({ actor: event.target.value || undefined })
                }
              >
                <option value="">전체 사용자</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {staffLabel(user, {
                      withOrganization: showsAllOrganizations,
                    })}{" "}
                    · {user.username}
                  </option>
                ))}
              </Select>
            </div>
            {recipientId && (
              <Button
                variant="secondary"
                size="sm"
                className="mb-0.5"
                aria-label="수급자 조건 지우기"
                onClick={() => filter({ recipient: undefined })}
              >
                수급자: {recipientName ?? "고른 수급자"}
                <XIcon />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">점검:</span>
            {CHECKS.map((check) => {
              const on = check.failed ? failedOnly : action === check.action;
              return (
                <button
                  key={check.label}
                  type="button"
                  aria-pressed={on}
                  className={cn(
                    "focus-visible:ring-ring/25 rounded-full border px-3 py-1 outline-none focus-visible:ring-3",
                    on
                      ? "border-primary bg-primary-soft text-primary font-medium"
                      : "hover:bg-muted",
                  )}
                  onClick={() =>
                    check.failed
                      ? filter({ failed: on ? undefined : "1" })
                      : filter({ action: on ? undefined : check.action })
                  }
                >
                  {check.label}
                </button>
              );
            })}
            {data && (
              <ListCount
                count={data.total}
                unit="건"
                isFetching={logs.isFetching}
                className="ml-auto"
              />
            )}
          </div>
        </div>

        {logs.isPending ? (
          <LoadingState message="접속기록을 불러오는 중입니다…" />
        ) : logs.isError ? (
          <ErrorState
            error={logs.error}
            title="접속기록을 불러오지 못했습니다"
            onRetry={() => void logs.refetch()}
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={ShieldCheckIcon}
            title="조건에 맞는 기록이 없습니다"
            description="기간이나 조건을 바꿔 보세요."
          />
        ) : (
          <>
            <AccessLogTable
              items={data.items}
              onRecipient={(id) => filter({ recipient: id })}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm">
              <span className="text-muted-foreground tabular-nums">
                {first}–{last} / 총 {data.total}건
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => updateSearch({ page: String(data.page - 1) })}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={last >= data.total}
                  onClick={() => updateSearch({ page: String(data.page + 1) })}
                >
                  다음
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
