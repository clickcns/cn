import { useQuery } from "@tanstack/react-query";
import { useScopeOrganizationId } from "@/features/organizations/hooks/use-organization-scope";
import { useRecipients } from "@/features/recipients/hooks/use-recipients";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * 재택의료 수입 화면의 한 달 자료: 그달 재택의료센터 방문(금액 셈에 쓰는 사실 포함)·수급자별 직전
 * 연속 개월과 활성 수급자. 달·기관을 바꾸면 새로 받는 동안 data는 undefined다(이전 달 방문으로
 * 이번 달을 판정하지 않게 placeholder를 두지 않는다).
 */
export function useHomeCareMonth(month: string) {
  const organizationId = useScopeOrganizationId();
  const query = { month, organizationId };
  const monthQuery = useQuery({
    queryKey: queryKeys.visits.homeCareMonth(query),
    queryFn: () => api.visits.homeCareMonth(query),
  });
  const recipientsQuery = useRecipients({
    organizationId,
    includeInactive: "false",
  });

  return {
    data: monthQuery.data,
    recipients: recipientsQuery.data,
    error: monthQuery.error ?? recipientsQuery.error,
    isFetching: monthQuery.isFetching,
    retry: () => {
      void monthQuery.refetch();
      void recipientsQuery.refetch();
    },
  };
}
