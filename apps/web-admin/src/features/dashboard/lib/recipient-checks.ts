import {
  homeCareMonthStatuses,
  summarizeMonthRecipients,
  withoutMonthVisits,
  type HomeCareMonthStatus,
  type Recipient,
  type VisitCalendarItem,
} from "@repo/shared-types";

/** 현황판의 이달 수급자 확인. */
export interface RecipientChecks {
  /** 재택의료센터 수급자별 월 요건(모자란 수급자부터) */
  homeCare: HomeCareMonthStatus<Recipient>[];
  /** 그중 요건이 모자란 수급자 */
  lacking: HomeCareMonthStatus<Recipient>[];
  /** 재택의료센터 밖의 수급자 중 이달 방문이 없는 수급자 */
  noVisit: Recipient[];
}

export function recipientChecks(
  visits: readonly VisitCalendarItem[],
  recipients: readonly Recipient[],
  month: string,
): RecipientChecks {
  const summaries = summarizeMonthRecipients(visits, month);
  const homeCare = homeCareMonthStatuses(recipients, summaries);
  return {
    homeCare,
    lacking: homeCare.filter((status) => status.shortfall > 0),
    noVisit: withoutMonthVisits(
      recipients.filter(
        (recipient) => !recipient.programs.includes("HOME_CARE_CENTER"),
      ),
      summaries,
    ),
  };
}
