import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useIsAdmin } from "@/features/auth/hooks/use-current-user";
import {
  useScopeOrganizationId,
  useSetScopeOrganization,
} from "@/features/organizations/hooks/use-organization-scope";
import { useOrganizations } from "@/features/organizations/hooks/use-organizations";

/**
 * 운영자의 기관 범위 콤보박스. 헤더 [기관 선택]과 목록 필터 줄의 "기관"이 같은 값(저장된 선택)을
 * 쓰므로 어느 쪽에서 바꿔도 모든 목록이 그 기관으로 좁혀진다.
 */
export function OrganizationScopeSelect({
  id,
  containerClassName,
  "aria-label": ariaLabel,
}: {
  id: string;
  containerClassName?: string;
  "aria-label"?: string;
}) {
  // 저장된 기관이 목록에 없으면(삭제 등) undefined라 전체로 보인다.
  const organizationId = useScopeOrganizationId();
  const setOrganizationId = useSetScopeOrganization();
  const { data: organizations, isPending } = useOrganizations();

  return (
    <Select
      id={id}
      aria-label={ariaLabel}
      containerClassName={containerClassName}
      value={organizationId ?? ""}
      disabled={isPending && !organizationId}
      onChange={(event) => setOrganizationId(event.target.value || null)}
    >
      <option value="">전체 기관</option>
      {/* 목록을 받기 전에도 저장된 선택값이 풀리지 않게 자리를 잡아 둔다. */}
      {isPending && organizationId && (
        <option value={organizationId}>불러오는 중…</option>
      )}
      {organizations?.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </Select>
  );
}

/**
 * 목록 필터 줄의 "기관"(운영자만 보인다). showLabel이 false면 위 이름표 없이
 * 콤보박스만 둔다(이름표 없는 필터 줄).
 */
export function OrganizationScopeFilter({
  id,
  showLabel = true,
}: {
  id: string;
  showLabel?: boolean;
}) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;

  return showLabel ? (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>기관</Label>
      <OrganizationScopeSelect id={id} containerClassName="w-52" />
    </div>
  ) : (
    <OrganizationScopeSelect
      id={id}
      aria-label="기관"
      containerClassName="w-52"
    />
  );
}
