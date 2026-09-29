import {
  formatKstDate,
  isIsoDate,
  isIsoMonth,
  monthOf,
} from "@repo/shared-types";
import { useSearchParams } from "react-router";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";

export type VisitView = "list" | "calendar";

/**
 * 방문 목록/달력 보기와 달력의 달·고른 날. 필터처럼 주소(쿼리스트링)에 두어
 * 상세 화면에 갔다가 돌아와도 유지된다. 고른 날은 늘 보고 있는 달 안에 있다.
 */
export function useVisitView() {
  const [searchParams] = useSearchParams();
  const today = formatKstDate();

  const view: VisitView =
    searchParams.get("view") === "calendar" ? "calendar" : "list";
  const monthParam = searchParams.get("month");
  const dayParam = searchParams.get("day");
  // 달력을 이 수급자 방문만 보게 한다(수급자 패널·빠른 보기에서 고름).
  const recipientId = searchParams.get("recipient") || undefined;
  const month = isIsoMonth(monthParam)
    ? monthParam
    : isIsoDate(dayParam)
      ? monthOf(dayParam)
      : monthOf(today);
  // 고른 날이 없으면 이번 달은 오늘, 그 밖의 달은 1일.
  const selectedDay =
    isIsoDate(dayParam) && monthOf(dayParam) === month
      ? dayParam
      : monthOf(today) === month
        ? today
        : `${month}-01`;

  // 바꾸는 함수는 늘 같다(방향키로 날짜를 옮겨도 달력 칸·수급자 패널에 넘긴 함수가 그대로라 다시 그리지 않는다).
  const update = useSearchParamsUpdater();

  return {
    view,
    month,
    selectedDay,
    today,
    recipientId,
    setRecipient: (next: string | undefined) => update({ recipient: next }),
    setView: (next: VisitView) =>
      update({ view: next === "calendar" ? "calendar" : undefined }),
    setMonth: (next: string) => update({ month: next, day: undefined }),
    /** 앞뒤 달 칸의 날짜를 누르면 그 달로 넘어간다. */
    selectDay: (date: string) => update({ month: monthOf(date), day: date }),
  };
}
