import {
  VISIT_LIST_MAX_PAGE_SIZE,
  type VisitListQuery,
} from "@repo/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/hooks/use-session";
import { api } from "@/lib/api";
import { visitKeys } from "@/lib/query-keys";

/*
 * 목록 응답은 페이지 단위(VisitListResponse)다. 하루 일정·수급자 한 명의 최근 방문은
 * 최대 페이지 크기 안에 들어오므로 첫 페이지 하나로 모두 받는다.
 */

/**
 * 내 방문 일정(하루). 기관 관리자는 서버가 기관 전체를 주므로
 * 현장 웹에서는 항상 staffId를 본인으로 넘긴다.
 */
export function useDailyVisits(date: string) {
  const staffId = useCurrentUser()?.id;
  const query: VisitListQuery = {
    date,
    staffId,
    pageSize: VISIT_LIST_MAX_PAGE_SIZE,
  };

  return useQuery({
    queryKey: visitKeys.list(query),
    queryFn: () => api.visits.list(query),
    enabled: Boolean(staffId),
  });
}

/**
 * 수급자 한 명의 기간 내 방문. 서버는 현장 직원에게 본인 방문만 주고,
 * 기관 관리자에게는 기관의 모든 담당자 방문을 준다.
 */
export function useRecipientVisits(
  recipientId: string,
  from: string,
  to: string,
) {
  const query: VisitListQuery = {
    recipientId,
    from,
    to,
    pageSize: VISIT_LIST_MAX_PAGE_SIZE,
  };

  return useQuery({
    queryKey: visitKeys.list(query),
    queryFn: () => api.visits.list(query),
    enabled: Boolean(recipientId),
  });
}

export function useVisit(id: string) {
  return useQuery({
    queryKey: visitKeys.detail(id),
    queryFn: () => api.visits.get(id),
    enabled: Boolean(id),
  });
}
