import { monthGridDates } from "@repo/shared-types";
import { useScopeOrganizationId } from "@/features/organizations/hooks/use-organization-scope";
import { useRecipients } from "@/features/recipients/hooks/use-recipients";
import { useVisitCalendar } from "@/features/visits/hooks/use-visits";

/**
 * 한 달의 방문 달력(날짜별 건수 + 방문 항목)과 활성 수급자. 현황판이 쓴다.
 * 요청 범위를 방문 달력과 같게(monthGridDates) 두어 캐시를 함께 쓴다. 달·기관을 바꾸는 동안
 * 남아 있는 이전 응답(placeholder)은 내주지 않는다(이전 달 방문으로 이번 달을 판정하지 않게).
 */
export function useMonthVisits(month: string) {
  const organizationId = useScopeOrganizationId();
  const dates = monthGridDates(month);
  const calendarQuery = useVisitCalendar({
    from: dates[0]!,
    to: dates.at(-1)!,
    organizationId,
    withVisits: "true",
  });
  const recipientsQuery = useRecipients({
    organizationId,
    includeInactive: "false",
  });
  const calendar = calendarQuery.isPlaceholderData
    ? undefined
    : calendarQuery.data;

  return {
    calendar,
    /** undefined는 받는 중, null은 방문이 너무 많아 목록 없음(운영자의 전체 기관 보기, 건수만 씀) */
    visits: calendar?.visits,
    recipients: recipientsQuery.data,
    calendarError: calendarQuery.error,
    error: calendarQuery.error ?? recipientsQuery.error,
    isFetching: calendarQuery.isFetching,
    retry: () => {
      void calendarQuery.refetch();
      void recipientsQuery.refetch();
    },
  };
}
