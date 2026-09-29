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
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";

export interface VisitFilters {
  /** YYYY-MM-DD (한국 날짜) */
  from: string;
  /** YYYY-MM-DD (한국 날짜, 그날 포함) */
  to: string;
  status: VisitStatus | undefined;
  program: Program | undefined;
  staffId: string | undefined;
}

/** 기간을 뺀 조회 조건. 달력은 기간을 달로 정하므로 이것만 받는다. */
export type VisitConditions = Pick<
  VisitFilters,
  "status" | "program" | "staffId"
>;

/**
 * 필터에서 기간을 뺀 조건만 새 객체로 고른다. 필터를 통째로 넘기면
 * 목록용 from/to가 달력 범위를 덮어쓰므로(펼침 순서) 반드시 이걸 거친다.
 */
export function visitConditions(filters: VisitFilters): VisitConditions {
  return {
    status: filters.status,
    program: filters.program,
    staffId: filters.staffId,
  };
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
  const [searchParams] = useSearchParams();
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

  const update = useSearchParamsUpdater();
  const setFilter = (key: FilterKey, value: string | undefined) =>
    update({ [key]: value });
  const resetFilters = () =>
    update(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])));

  return { filters, setFilter, resetFilters, isCustomized };
}
