import { VISIT_STATUS_LABELS, type VisitStatus } from "@repo/shared-types";
import { CircleCheckIcon, ClockIcon, PencilLineIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS_STYLES: Record<
  VisitStatus,
  { variant: BadgeVariant; icon: typeof ClockIcon }
> = {
  SCHEDULED: { variant: "primary", icon: ClockIcon },
  DRAFT: { variant: "warning", icon: PencilLineIcon },
  CONFIRMED: { variant: "success", icon: CircleCheckIcon },
};

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const { variant, icon: Icon } = STATUS_STYLES[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {VISIT_STATUS_LABELS[status]}
    </Badge>
  );
}
