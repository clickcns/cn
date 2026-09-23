import { VISIT_STATUS_LABELS, type VisitStatus } from "@repo/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<VisitStatus, BadgeVariant> = {
  SCHEDULED: "primary",
  DRAFT: "warning",
  CONFIRMED: "success",
};

export function VisitStatusBadge({
  status,
  className,
}: {
  status: VisitStatus;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={className}>
      {VISIT_STATUS_LABELS[status]}
    </Badge>
  );
}
