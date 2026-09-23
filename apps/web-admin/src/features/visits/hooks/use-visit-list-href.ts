import { useLocation } from "react-router";
import { ROUTES } from "@/lib/routes";

/** 방문 목록에서 상세로 갈 때 넘기는 state. 돌아갈 때 목록 필터를 되살린다. */
export interface VisitListLinkState {
  listSearch: string;
}

/** 상세 화면에서 돌아갈 방문 목록 주소. 목록에서 왔으면 그때의 필터를 붙인다. */
export function useVisitListHref(): string {
  const { state } = useLocation();
  const listSearch =
    typeof state === "object" &&
    state !== null &&
    "listSearch" in state &&
    typeof state.listSearch === "string" &&
    state.listSearch.startsWith("?")
      ? state.listSearch
      : "";
  return `${ROUTES.visits}${listSearch}`;
}
