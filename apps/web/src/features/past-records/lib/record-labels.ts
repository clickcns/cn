import {
  recordDate,
  staffDisplayName,
  type RecipientRecord,
} from "@repo/shared-types";
import { formatDateLabel } from "@/lib/date";

/** 지난 기록의 방문 날짜: "9월 22일 (화)" */
export function recordDateLabel(
  record: Pick<RecipientRecord, "startedAt" | "scheduledAt">,
): string {
  return formatDateLabel(recordDate(record));
}

/** 지난 기록의 담당자: 그 방문의 직종으로 "정의사 (의사)" */
export function recordStaffLabel(
  record: Pick<RecipientRecord, "staff" | "profession">,
): string {
  return staffDisplayName({
    name: record.staff.name,
    profession: record.profession,
  });
}
