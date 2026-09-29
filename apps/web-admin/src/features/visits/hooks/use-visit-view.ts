import {
  formatKstDate,
  isIsoDate,
  isIsoMonth,
  monthOf,
} from "@repo/shared-types";
import { useSearchParams } from "react-router";

export type VisitView = "list" | "calendar";

/**
 * 방문 목록/달력 보기와 달력의 달·고른 날. 필터처럼 주소(쿼리스트링)에 두어
 * 상세 화면에 갔다가 돌아와도 유지된다. 고른 날은 늘 보고 있는 달 안에 있다.
 */
export function useVisitView() {
  const [searchParams, setSearchParams] = useSearchParams();
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

  const update = (changes: Record<string, string | undefined>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

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
