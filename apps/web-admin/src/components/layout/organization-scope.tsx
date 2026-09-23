import { Building2Icon } from "lucide-react";
import { Select } from "@/components/ui/select";
import {
  useCurrentUser,
  useIsAdmin,
} from "@/features/auth/hooks/use-current-user";
import { useScopeOrganizationId } from "@/features/organizations/hooks/use-organization-scope";
import { useOrganizations } from "@/features/organizations/hooks/use-organizations";
import { useOrganizationScopeStore } from "@/features/organizations/stores/use-organization-scope-store";

/**
 * 헤더 왼쪽의 기관 표시.
 * 운영자는 기관을 골라 모든 목록을 그 기관으로 좁히고, 기관 관리자는 자기 기관 이름만 본다.
 */
export function OrganizationScope() {
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();

  if (isAdmin) return <OrganizationScopeSelect />;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Building2Icon className="text-muted-foreground size-4" aria-hidden />
      <span className="font-semibold">
        {user?.organizationName ?? "소속 기관 없음"}
      </span>
    </div>
  );
}

function OrganizationScopeSelect() {
  // 저장된 기관이 목록에 없으면(삭제 등) undefined라 전체로 보인다.
  const organizationId = useScopeOrganizationId();
  const setOrganizationId = useOrganizationScopeStore(
    (s) => s.setOrganizationId,
  );
  const { data: organizations, isPending, isError } = useOrganizations();

  return (
    <div className="flex items-center gap-2.5">
      <label
        htmlFor="organization-scope"
        className="text-muted-foreground flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap"
      >
        <Building2Icon className="size-4" aria-hidden />
        기관 선택
      </label>
      <Select
        id="organization-scope"
        containerClassName="w-64"
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
      {isError && (
        <span className="text-destructive text-[13px]">
          기관 목록을 불러오지 못했습니다
        </span>
      )}
    </div>
  );
}
