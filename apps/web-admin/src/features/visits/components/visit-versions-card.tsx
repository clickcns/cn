import {
  CARE_GRADE_LABELS,
  PROFESSION_LABELS,
  withParticle,
  type VisitDetail,
  type VisitRecordVersionDetail,
} from "@repo/shared-types";
import {
  ChevronRightIcon,
  HistoryIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/data-state";
import { DescriptionList } from "@/components/ui/description-list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecordFormCards } from "@/features/visits/components/visit-record-view";
import {
  useVisitVersion,
  useVisitVersions,
} from "@/features/visits/hooks/use-visits";
import {
  formatBirthDate,
  formatDateTime,
  formatVisitTimeRange,
  orDash,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/** "정의사가 확정" */
const byName = (name: string, action: string) =>
  `${withParticle(name, "이/가")} ${action}`;

/**
 * 확정 이력: 확정할 때마다 원본으로 보관한 확정본(1차, 2차 …). 누르면 그때 확정한 기록을
 * 보고, 보관한 뒤 바뀌지 않았는지 확인한다. 확정한 적이 없으면 보이지 않는다.
 */
export function VisitVersionsCard({ visit }: { visit: VisitDetail }) {
  const [openVersion, setOpenVersion] = useState<number | null>(null);
  const versionsQuery = useVisitVersions(visit.id, visit.versionCount > 0);
  if (visit.versionCount === 0) return null;
  const versions = versionsQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HistoryIcon className="text-primary size-4" />
          확정 이력
          <span className="text-muted-foreground font-normal tabular-nums">
            {visit.versionCount}건
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {versionsQuery.isError ? (
          <ErrorState
            error={versionsQuery.error}
            title="확정 이력을 불러오지 못했습니다"
            onRetry={() => void versionsQuery.refetch()}
            className="py-6"
          />
        ) : !versions ? (
          <LoadingState className="py-6" />
        ) : (
          <ol className="grid gap-0.5">
            {[...versions].reverse().map((version) => (
              <li key={version.version}>
                <button
                  type="button"
                  onClick={() => setOpenVersion(version.version)}
                  className="hover:bg-muted focus-visible:ring-ring/25 group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left outline-none focus-visible:ring-3"
                >
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {version.version}차 확정본
                      {/* 되돌리지 않은 확정본은 지금 확정본뿐이다. */}
                      {version.reopenedAt === null &&
                        visit.status === "CONFIRMED" && (
                          <Badge
                            variant="success"
                            className="h-5 px-1.5 text-[11px]"
                          >
                            지금 확정본
                          </Badge>
                        )}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatDateTime(version.confirmedAt)} ·{" "}
                      {byName(version.confirmedBy.name, "확정")}
                    </span>
                    {version.reopenedAt && (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatDateTime(version.reopenedAt)} ·{" "}
                        {byName(
                          version.reopenedBy?.name ?? "알 수 없는 사용자",
                          "[수정]으로 되돌림",
                        )}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon
                    className="text-muted-foreground group-hover:text-foreground size-4 shrink-0"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ol>
        )}
        <p className="text-muted-foreground text-xs">
          확정할 때마다 그때의 기록을 원본으로 보관합니다. [수정]으로 고쳐도
          이전 원본은 지워지지 않습니다. 누르면 그때 기록을 봅니다.
        </p>
      </CardContent>
      <VisitVersionDialog
        visitId={visit.id}
        version={openVersion}
        onClose={() => setOpenVersion(null)}
      />
    </Card>
  );
}

function VisitVersionDialog({
  visitId,
  version,
  onClose,
}: {
  visitId: string;
  version: number | null;
  onClose: () => void;
}) {
  const query = useVisitVersion(visitId, version);
  const detail = query.data;

  return (
    <Dialog
      open={version !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{version}차 확정본</DialogTitle>
          <DialogDescription>
            {detail
              ? `${formatDateTime(detail.confirmedAt)} ${byName(detail.confirmedBy.name, "확정")}한 그대로 보관한 기록입니다.`
              : "확정할 때 보관한 기록입니다."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          {query.isError ? (
            <ErrorState
              error={query.error}
              title="확정본을 불러오지 못했습니다"
              onRetry={() => void query.refetch()}
            />
          ) : !detail ? (
            <LoadingState message="확정본을 불러오는 중입니다…" />
          ) : (
            <VersionContent detail={detail} />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function VersionContent({ detail }: { detail: VisitRecordVersionDetail }) {
  const { snapshot } = detail;
  const { organization, recipient, staff } = snapshot.header;

  return (
    <>
      <IntegrityNotice matches={detail.hashMatches} />
      {detail.reopenedAt && (
        <p className="text-muted-foreground -mt-2 text-sm">
          {formatDateTime(detail.reopenedAt)}에{" "}
          {byName(detail.reopenedBy?.name ?? "알 수 없는 사용자", "[수정]")}
          으로 되돌렸으므로 지금 기록과 다를 수 있습니다.
        </p>
      )}

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">확정할 때의 정보</h3>
        <DescriptionList
          columns={2}
          items={[
            {
              label: "기관",
              value: organization.code
                ? `${organization.name} (${organization.code})`
                : organization.name,
            },
            {
              label: "방문 시각",
              value: snapshot.startedAt
                ? formatVisitTimeRange(
                    snapshot.startedAt,
                    snapshot.startedAt,
                    snapshot.endedAt,
                  )
                : "—",
            },
            {
              label: "수급자",
              value: [
                recipient.name,
                recipient.careGrade && CARE_GRADE_LABELS[recipient.careGrade],
                recipient.chartNumber && `차트 ${recipient.chartNumber}`,
              ]
                .filter(Boolean)
                .join(" · "),
            },
            { label: "생년월일", value: formatBirthDate(recipient.birthDate) },
            {
              label: "담당자",
              value: [
                staff.name,
                PROFESSION_LABELS[snapshot.profession],
                staff.licenseNumber && `면허 ${staff.licenseNumber}`,
              ]
                .filter(Boolean)
                .join(" · "),
            },
            {
              label: "장기요양인정번호",
              value: orDash(recipient.ltcCertNumber),
            },
            { label: "주소", value: orDash(recipient.address), wide: true },
          ]}
        />
      </section>

      <RecordFormCards formIds={snapshot.formIds} forms={snapshot.forms} />

      <details className="text-muted-foreground text-xs">
        <summary className="hover:text-foreground w-fit cursor-pointer select-none">
          기술 정보
        </summary>
        <p className="mt-2">
          위변조 확인값(SHA-256). 확정할 때 기록 전체로 계산해 둔 값으로, 지금
          다시 계산한 값과 같으면 원본 그대로입니다.
        </p>
        <p className="mt-1 font-mono break-all">{detail.hash}</p>
      </details>
    </>
  );
}

/** 보관한 뒤 바뀌지 않았는지: 사용자에게는 확인값 대신 결과만 쉬운 말로 알린다. */
function IntegrityNotice({ matches }: { matches: boolean }) {
  const Icon = matches ? ShieldCheckIcon : ShieldAlertIcon;
  return (
    <div
      role={matches ? undefined : "alert"}
      className={cn(
        "flex items-start gap-2.5 rounded-md px-3.5 py-3",
        matches
          ? "bg-success-soft text-success"
          : "bg-destructive-soft text-destructive",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="grid gap-0.5">
        <p className="text-sm font-semibold">
          {matches ? "원본 그대로입니다" : "원본과 다릅니다"}
        </p>
        <p className="text-foreground/80 text-[13px]">
          {matches
            ? "확정한 뒤로 바뀐 내용이 없습니다."
            : "확정한 뒤 보관한 기록이 바뀌었을 수 있습니다. 운영자에게 알려 주세요."}
        </p>
      </div>
    </div>
  );
}
