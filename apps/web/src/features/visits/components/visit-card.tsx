import { PROGRAM_LABELS, type VisitSummary } from "@repo/shared-types";
import { MapPin } from "lucide-react";
import { Link } from "react-router";
import { CareGradeBadge } from "@/features/recipients/components/care-grade-badge";
import { MapMenuButton } from "@/features/recipients/components/map-links";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import { formatTimeLabel } from "@/lib/date";
import { visitPath } from "@/lib/routes";

/**
 * 방문 목록의 카드 한 장(하루 일정). 카드 전체가 기록 화면으로 가는 링크이고
 * (이름 링크를 카드 크기로 넓힌다), [지도] 버튼만 그 위에 따로 눌린다.
 */
export function VisitCard({ visit }: { visit: VisitSummary }) {
  const { recipient } = visit;

  return (
    <div className="border-border bg-card hover:border-primary/40 has-[a:focus-visible]:ring-ring/30 has-[a:active]:bg-muted relative flex h-full min-h-24 gap-4 rounded-2xl border p-4 transition-colors has-[a:focus-visible]:ring-4">
      <span className="text-primary min-w-16 shrink-0 pt-0.5 text-xl font-bold whitespace-nowrap tabular-nums">
        {formatTimeLabel(visit.scheduledAt)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              to={visitPath(visit.id)}
              className="text-lg font-bold outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {/* 카드 전체를 덮는 링크라, 화면 읽기 프로그램에는 시각도 함께 읽힌다. */}
              <span className="sr-only">
                {formatTimeLabel(visit.scheduledAt)}{" "}
              </span>
              {recipient.name}
            </Link>
            <CareGradeBadge grade={recipient.careGrade} />
          </div>
          <VisitStatusBadge status={visit.status} />
        </div>
        <p className="text-primary text-sm font-semibold">
          {PROGRAM_LABELS[visit.program]}
        </p>
        <div className="text-muted-foreground flex items-center gap-1.5">
          <MapPin className="size-4 shrink-0" />
          <span className="line-clamp-2 min-w-0 flex-1">
            {recipient.address ?? "주소 없음"}
          </span>
          {recipient.address && (
            <MapMenuButton
              address={recipient.address}
              label={`${recipient.name} 님 주소를 지도에서 열기`}
              className="relative z-10 -my-3"
            />
          )}
        </div>
      </div>
    </div>
  );
}
