import {
  formatKstDate,
  homeCareFeeStatuses,
  homeCareFeeTotals,
  homeCareMonthRevenue,
} from "@repo/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useScopeOrganizationId } from "@/features/organizations/hooks/use-organization-scope";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * 재택의료 수입의 한 달: 그달 재택의료센터 방문(금액 셈에 쓰는 사실 포함)·수급자(사례 정보 포함)·
 * 직전 연속 개월·그달 수가 묶음을 받아 판정(homeCareFeeStatuses)·판정별 기본료·예상 수입을 낸다. 재택의료 수입
 * 화면과 현황판이 같은 판정을 쓴다. 달·기관을 바꾸면 새로 받는 동안 judged는 undefined다(이전 달
 * 방문으로 이번 달을 판정하지 않게 placeholder를 두지 않는다).
 */
export function useHomeCareMonth(month: string) {
  const organizationId = useScopeOrganizationId();
  const query = { month, organizationId };
  const monthQuery = useQuery({
    queryKey: queryKeys.visits.homeCareMonth(query),
    queryFn: () => api.visits.homeCareMonth(query),
  });
  const data = monthQuery.data;
  const today = formatKstDate();
  // null은 방문이 너무 많아 목록 없음(운영자의 전체 기관 보기), undefined는 받는 중.
  const judged = useMemo(() => {
    if (!data) return undefined;
    if (!data.visits) return null;
    const statuses = homeCareFeeStatuses(
      data.recipients,
      data.visits,
      month,
      today,
      data.feeSet.fees,
    );
    return {
      statuses,
      totals: homeCareFeeTotals(statuses),
      revenue: homeCareMonthRevenue(
        statuses,
        data.visits,
        data.priorStreaks,
        data.feeSet.fees,
      ),
    };
  }, [data, month, today]);

  return {
    visits: data?.visits,
    /** 그달 수가 묶음과 근거(받는 중이면 undefined) */
    feeSet: data?.feeSet,
    judged,
    error: monthQuery.error,
    isFetching: monthQuery.isFetching,
    retry: () => void monthQuery.refetch(),
  };
}
