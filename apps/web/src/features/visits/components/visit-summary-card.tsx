import {
  PROGRAM_LABELS,
  staffDisplayName,
  type VisitDetail,
} from "@repo/shared-types";
import { CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import { formatDateTimeLabel } from "@/lib/date";

/** 방문 기록 화면 맨 위: 방문 일시·상태·사업·담당자. */
export function VisitSummaryCard({ visit }: { visit: VisitDetail }) {
  return (
    <Card className="gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-lg font-bold tabular-nums">
          <CalendarClock className="text-primary size-5 shrink-0" />
          {formatDateTimeLabel(visit.scheduledAt)}
        </p>
        <VisitStatusBadge status={visit.status} />
      </div>
      <p className="text-muted-foreground">
        {PROGRAM_LABELS[visit.program]} · 담당 {staffDisplayName(visit.staff)}
      </p>
    </Card>
  );
}
