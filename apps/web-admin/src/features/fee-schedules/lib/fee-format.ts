import {
  addMonths,
  scheduleForMonth,
  type HomeCareFeeField,
  type HomeCareFees,
  type HomeCareFeeScheduleList,
} from "@repo/shared-types";
import { formatNumber } from "@/lib/format";

/** "140,000원", "75%", "3회" */
export function formatFee(field: HomeCareFeeField, value: number): string {
  return `${formatNumber(value)}${field.unit}`;
}

/** 그 달 바로 전 달에 쓰는 수가(바뀐 칸 비교·새 묶음의 시작 값). 지운 묶음은 건너뛴다. */
export function feesBefore(
  list: HomeCareFeeScheduleList,
  month: string,
): HomeCareFees {
  return (
    scheduleForMonth(list.schedules, addMonths(month, -1))?.fees ??
    list.defaults.fees
  );
}
