import { ROLE_LABELS, type Role } from "@repo/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

const ROLE_VARIANTS: Record<Role, BadgeVariant> = {
  ADMIN: "primary",
  MANAGER: "outline",
  STAFF: "neutral",
};

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={ROLE_VARIANTS[role]}>{ROLE_LABELS[role]}</Badge>;
}
