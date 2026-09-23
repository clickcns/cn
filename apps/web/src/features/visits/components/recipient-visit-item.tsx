import { PROGRAM_LABELS, type VisitSummary } from "@repo/shared-types";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import { formatDateTimeLabel } from "@/lib/date";
import { visitPath } from "@/lib/routes";

/** 수급자 상세의 방문 이력 한 줄. */
export function RecipientVisitItem({ visit }: { visit: VisitSummary }) {
  return (
    <Link
      to={visitPath(visit.id)}
      className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring/30 active:bg-muted flex min-h-18 items-center gap-3 rounded-2xl border px-4 py-3 transition-colors outline-none focus-visible:ring-4"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg font-semibold tabular-nums">
          {formatDateTimeLabel(visit.scheduledAt)}
        </span>
        <span className="text-muted-foreground">
          {PROGRAM_LABELS[visit.program]} · 담당 {visit.staff.name}
        </span>
      </div>
      <VisitStatusBadge status={visit.status} />
      <ChevronRight className="text-muted-foreground size-6 shrink-0" />
    </Link>
  );
}
