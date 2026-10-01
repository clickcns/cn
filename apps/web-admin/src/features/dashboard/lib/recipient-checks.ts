import {
  isFeeAtRisk,
  summarizeMonthRecipients,
  withoutMonthVisits,
  type HomeCareFeeStatus,
  type HomeCareRecipient,
  type Recipient,
  type VisitCalendarItem,
} from "@repo/shared-types";

/** 현황판의 이달 수급자 확인. */
export interface RecipientChecks {
  /** 재택의료센터 수급자 수 */
  homeCareCount: number;
  /** 그중 지금 일정(예정 포함)으로는 요건이 모자라거나 포괄평가가 필요한 수급자(위험한 것부터) */
  lacking: HomeCareFeeStatus<HomeCareRecipient>[];
  /** 재택의료센터 밖의 수급자 중 이달 방문이 없는 수급자 */
  noVisit: Recipient[];
}

/**
 * 재택의료 판정(useHomeCareMonth: 재택의료 수입과 같은 판정)에서 기본료가 위험한 수급자와, 달력
 * 방문으로 센 재택의료 밖 수급자의 이달 방문 여부를 합친다.
 */
export function recipientChecks(
  visits: readonly VisitCalendarItem[],
  recipients: readonly Recipient[],
  month: string,
  homeCare: readonly HomeCareFeeStatus<HomeCareRecipient>[],
): RecipientChecks {
  return {
    homeCareCount: homeCare.length,
    lacking: homeCare.filter((status) => isFeeAtRisk(status.verdict)),
    noVisit: withoutMonthVisits(
      recipients.filter(
        (recipient) => !recipient.programs.includes("HOME_CARE_CENTER"),
      ),
      summarizeMonthRecipients(visits, month),
    ),
  };
}
