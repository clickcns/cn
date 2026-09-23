import type { CareGrade } from "@repo/shared-types";
import { Badge } from "@/components/ui/badge";
import { formatCareGrade } from "@/features/recipients/lib/format";

export function CareGradeBadge({
  grade,
  className,
}: {
  grade: CareGrade | null;
  className?: string;
}) {
  const label = formatCareGrade(grade);
  if (!label) return null;

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
