import { Select } from "@/components/ui/select";
import {
  useScopeOrganizationId,
  useSetScopeOrganization,
} from "@/features/organizations/hooks/use-organization-scope";
import { useOrganizations } from "@/features/organizations/hooks/use-organizations";

/**
 * 운영자의 기관 범위 콤보박스(헤더 [기관 선택]). 고른 값은 저장되어 모든 화면의 목록을
 * 그 기관으로 좁힌다.
 */
export function OrganizationScopeSelect({
  id,
  containerClassName,
}: {
  id: string;
  containerClassName?: string;
}) {
  // 저장된 기관이 목록에 없으면(삭제 등) undefined라 전체로 보인다.
  const organizationId = useScopeOrganizationId();
  const setOrganizationId = useSetScopeOrganization();
  const { data: organizations, isPending } = useOrganizations();

  return (
    <Select
      id={id}
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
