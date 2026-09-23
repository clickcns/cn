import {
  PROFESSION_LABELS,
  ROLE_LABELS,
  type UserSummary,
} from "@repo/shared-types";

/**
 * 담당자 선택 항목의 문구.
 * 예: "정의사 (의사)", "김관리 (기관 관리자·간호사) · 행복요양원", "이간호 (간호사, 비활성)"
 */
export function staffLabel(
  user: UserSummary,
  { withOrganization = false }: { withOrganization?: boolean } = {},
): string {
  const parts = [
    user.role === "STAFF" ? null : ROLE_LABELS[user.role],
    user.profession ? PROFESSION_LABELS[user.profession] : null,
  ].filter(Boolean);
  let label =
    parts.length > 0 ? `${user.name} (${parts.join("·")})` : user.name;
  if (!user.isActive) label += " (비활성)";
  if (withOrganization && user.organizationName) {
    label += ` · ${user.organizationName}`;
  }
  return label;
}
