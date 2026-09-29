import { VISIT_STATUS_LABELS, type VisitStatus } from "@repo/shared-types";
import { Badge } from "@/components/ui/badge";
import { VISIT_STATUS_STYLES } from "@/features/visits/lib/status-styles";

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const { variant, icon: Icon } = VISIT_STATUS_STYLES[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {VISIT_STATUS_LABELS[status]}
    </Badge>
  );
}
