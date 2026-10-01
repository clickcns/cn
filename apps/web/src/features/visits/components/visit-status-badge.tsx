import { VISIT_STATUS_LABELS, type VisitStatus } from "@repo/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<VisitStatus, BadgeVariant> = {
  SCHEDULED: "primary",
  DRAFT: "warning",
  CONFIRMED: "success",
};

export function VisitStatusBadge({
  status,
  size,
  className,
}: {
  status: VisitStatus;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} size={size} className={className}>
      {VISIT_STATUS_LABELS[status]}
    </Badge>
  );
}
