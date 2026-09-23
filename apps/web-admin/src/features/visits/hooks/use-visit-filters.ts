import {
  addKstDays,
  formatKstDate,
  isIsoDate,
  PROGRAMS,
  VISIT_STATUSES,
  type Program,
  type VisitStatus,
} from "@repo/shared-types";
import { useSearchParams } from "react-router";

export interface VisitFilters {
  /** YYYY-MM-DD (한국 날짜) */
  from: string;
  /** YYYY-MM-DD (한국 날짜, 그날 포함) */
  to: string;
  status: VisitStatus | undefined;
  program: Program | undefined;
  staffId: string | undefined;
}

type FilterKey = keyof VisitFilters;
const FILTER_KEYS: FilterKey[] = ["from", "to", "status", "program", "staffId"];

/** 기본 조회 기간: 오늘 기준 앞뒤 7일. */
export function defaultVisitRange(today: string = formatKstDate()) {
  return { from: addKstDays(today, -7), to: addKstDays(today, 7) };
}

/**
 * 방문 목록 필터. 주소(쿼리스트링)에 두어 상세 화면에 갔다가 돌아와도 유지된다.
 * 값이 없거나 잘못되면 기본값을 쓴다.
 */
export function useVisitFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaults = defaultVisitRange();

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const program = searchParams.get("program");
  const filters: VisitFilters = {
    from: isIsoDate(from) ? from : defaults.from,
    to: isIsoDate(to) ? to : defaults.to,
    status: VISIT_STATUSES.find((value) => value === status),
    program: PROGRAMS.find((value) => value === program),
    staffId: searchParams.get("staffId") || undefined,
  };
  const isCustomized = FILTER_KEYS.some((key) => searchParams.has(key));

  const setFilter = (key: FilterKey, value: string | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const resetFilters = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of FILTER_KEYS) next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  return { filters, setFilter, resetFilters, isCustomized };
}
