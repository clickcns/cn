import {
  homeCareFeeStatuses,
  homeCareFeeTotals,
  summarizeMonthRecipients,
  withoutMonthVisits,
  type HomeCareFeeStatus,
  type Recipient,
  type VisitCalendarItem,
} from "@repo/shared-types";

/** 현황판의 이달 수급자 확인. */
export interface RecipientChecks {
  /** 재택의료센터 수급자별 이달 기본료 판정(위험한 것부터) */
  homeCare: HomeCareFeeStatus<Recipient>[];
  /** 그중 지금 일정(예정 포함)으로는 요건이 모자란 수급자 */
  lacking: HomeCareFeeStatus<Recipient>[];
  /** 판정별 수급자 수와 기본료 합계 */
  feeTotals: ReturnType<typeof homeCareFeeTotals>;
  /** 재택의료센터 밖의 수급자 중 이달 방문이 없는 수급자 */
  noVisit: Recipient[];
}

export function recipientChecks(
  visits: readonly VisitCalendarItem[],
  recipients: readonly Recipient[],
  month: string,
  today: string,
): RecipientChecks {
  const homeCare = homeCareFeeStatuses(recipients, visits, month, today);
  return {
    homeCare,
    lacking: homeCare.filter((status) => status.verdict === "SHORT"),
    feeTotals: homeCareFeeTotals(homeCare),
    noVisit: withoutMonthVisits(
      recipients.filter(
        (recipient) => !recipient.programs.includes("HOME_CARE_CENTER"),
      ),
      summarizeMonthRecipients(visits, month),
    ),
  };
}
