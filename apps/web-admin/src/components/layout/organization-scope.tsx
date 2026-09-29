import { Building2Icon } from "lucide-react";
import {
  useCurrentUser,
  useIsAdmin,
} from "@/features/auth/hooks/use-current-user";
import { OrganizationScopeSelect } from "@/features/organizations/components/organization-scope-select";
import { useOrganizations } from "@/features/organizations/hooks/use-organizations";

/**
 * 헤더 왼쪽의 기관 표시.
 * 운영자는 기관을 골라 모든 목록을 그 기관으로 좁히고, 기관 관리자는 자기 기관 이름만 본다.
 */
export function OrganizationScope() {
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();

  if (isAdmin) return <HeaderOrganizationScope />;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Building2Icon className="text-muted-foreground size-4" aria-hidden />
      <span className="font-semibold">
        {user?.organizationName ?? "소속 기관 없음"}
      </span>
    </div>
  );
}

function HeaderOrganizationScope() {
  const { isError } = useOrganizations();

  return (
    <div className="flex items-center gap-2.5">
      <label
        htmlFor="organization-scope"
        className="text-muted-foreground flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap"
      >
        <Building2Icon className="size-4" aria-hidden />
        기관 선택
      </label>
      <OrganizationScopeSelect
        id="organization-scope"
        containerClassName="w-64"
      />
      {isError && (
        <span className="text-destructive text-[13px]">
          기관 목록을 불러오지 못했습니다
        </span>
      )}
    </div>
  );
}
