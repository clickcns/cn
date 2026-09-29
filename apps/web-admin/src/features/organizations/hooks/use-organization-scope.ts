import { useIsAdmin } from "@/features/auth/hooks/use-current-user";
import {
  useOrganizationNameMap,
  useOrganizations,
} from "@/features/organizations/hooks/use-organizations";
import { useOrganizationScopeStore } from "@/features/organizations/stores/use-organization-scope-store";

/**
 * 목록 조회에 넘길 organizationId.
 * 운영자만 헤더의 선택값을 쓴다. 기관 관리자는 서버가 자기 기관으로 고정하므로 넘기지 않는다.
 * 저장된 기관이 기관 목록에 없으면(DB 초기화 등) 전체로 본다.
 */
export function useScopeOrganizationId(): string | undefined {
  const isAdmin = useIsAdmin();
  const selected = useOrganizationScopeStore((s) => s.organizationId);
  const { data: organizations } = useOrganizations();

  if (!isAdmin || !selected) return undefined;
  if (organizations && !organizations.some((org) => org.id === selected)) {
    return undefined;
  }
  return selected;
}

/** 운영자가 "전체 기관"을 보고 있어 목록에 기관 열이 필요한지. */
export function useShowsAllOrganizations(): boolean {
  const isAdmin = useIsAdmin();
  const scopeId = useScopeOrganizationId();
  return isAdmin && scopeId === undefined;
}

/**
 * 목록의 기관 열에 쓸 기관 id → 이름.
 * 운영자가 "전체 기관"을 볼 때만 돌려주고, 한 기관만 볼 때는 undefined(기관 열을 숨긴다).
 */
export function useOrganizationColumnNames(): Map<string, string> | undefined {
  const showsAllOrganizations = useShowsAllOrganizations();
  const organizationNames = useOrganizationNameMap();
  return showsAllOrganizations ? organizationNames : undefined;
}

/**
 * 운영자의 기관 선택을 바꾼다(null이면 전체 기관). 헤더·필터 줄의 콤보박스와
 * 목록의 기관 묶음 머리 줄 [이 기관만 보기]가 쓴다(모든 목록이 그 기관으로 좁혀진다).
 */
export function useSetScopeOrganization(): (
  organizationId: string | null,
) => void {
  return useOrganizationScopeStore((s) => s.setOrganizationId);
}
