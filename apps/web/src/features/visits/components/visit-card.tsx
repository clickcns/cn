import { PROGRAM_LABELS, type VisitSummary } from "@repo/shared-types";
import { MapPin } from "lucide-react";
import { Link } from "react-router";
import { CareGradeBadge } from "@/features/recipients/components/care-grade-badge";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import { formatTimeLabel } from "@/lib/date";
import { visitPath } from "@/lib/routes";

/** 방문 목록의 카드 한 장(하루 일정). */
export function VisitCard({ visit }: { visit: VisitSummary }) {
  const { recipient } = visit;

  return (
    <Link
      to={visitPath(visit.id)}
      className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring/30 active:bg-muted flex h-full min-h-24 gap-4 rounded-2xl border p-4 transition-colors outline-none focus-visible:ring-4"
    >
      <span className="text-primary min-w-16 shrink-0 pt-0.5 text-xl font-bold whitespace-nowrap tabular-nums">
        {formatTimeLabel(visit.scheduledAt)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{recipient.name}</span>
            <CareGradeBadge grade={recipient.careGrade} />
          </div>
          <VisitStatusBadge status={visit.status} />
        </div>
        <p className="text-primary text-sm font-semibold">
          {PROGRAM_LABELS[visit.program]}
        </p>
        <p className="text-muted-foreground flex items-center gap-1.5">
          <MapPin className="size-4 shrink-0" />
          <span className="truncate">{recipient.address ?? "주소 없음"}</span>
        </p>
      </div>
    </Link>
  );
}
