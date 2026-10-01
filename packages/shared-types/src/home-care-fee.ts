import { addMonths } from "./date.js";
import { HOME_CARE_MONTHLY_VISITS, type Program } from "./programs.js";
import { PROFESSIONS, type Profession } from "./roles.js";
import {
  homeCareMissing,
  homeCareShortfall,
  kstDateInMonth,
  type HomeCareVisitCounts,
  type VisitCalendarItem,
} from "./visit.js";

/*
 * 재택의료기본료 판정(장기요양 재택의료센터 시범사업 지침 2026.2, 13쪽).
 * 수급자당 월 1회, 그달(1일~말일) 의사 1회·간호사 2회·사회복지사 상담 1회를 모두 채워야 산정한다.
 * 하나라도 빠지면 그달 기본료는 0원이다. 의사·간호사가 함께 방문하면 각각 센다(방문 한 건이
 * 방문한 직종 하나로 세어지므로 그대로 맞다). 방문 직종은 담당자의 지금 직종이 아니라
 * 방문에 저장한 직종(profession)이다.
 * 아직 보지 않는 규칙: 첫 포괄평가 달의 산정 기간(포괄평가일부터 말일), 케어플랜 없는 긴급왕진
 * 제외, 의사 1인당 월 140명, 사망 종결 50%, 다른 기관 서비스와 같은 날 겹침.
 */

/** 재택의료기본료(수급자당 월, 원). 수가가 바뀌면 여기만 고친다. */
export const HOME_CARE_BASE_FEE = 140_000;

/** 이달 재택의료 방문 중 한 직종의 건수. */
export interface HomeCareTally {
  confirmed: number;
  /** 지난 날짜인데 확정하지 않은 방문(예정·작성 중) */
  unconfirmedPast: number;
  /** 오늘부터의 예정·작성 중 방문 */
  upcoming: number;
}

/** 위험한 것부터: 지금 일정으로는 못 채움 → 남은 방문·확정을 마치면 채움 → 확정 기록으로 채움. */
export const HOME_CARE_FEE_VERDICTS = ["SHORT", "PENDING", "SECURED"] as const;
export type HomeCareFeeVerdict = (typeof HOME_CARE_FEE_VERDICTS)[number];

export const HOME_CARE_FEE_VERDICT_LABELS: Record<HomeCareFeeVerdict, string> =
  {
    SHORT: "방문 부족",
    PENDING: "확정 남음",
    SECURED: "확보",
  };

/** 재택의료센터 수급자 한 명의 그달 기본료 판정. */
export interface HomeCareFeeStatus<T> {
  recipient: T;
  tallies: Record<Profession, HomeCareTally>;
  verdict: HomeCareFeeVerdict;
  /** 직종별로 더 잡아야 할 방문(예정·미확정을 모두 마쳐도 모자란 수) */
  missing: HomeCareVisitCounts;
  /** missing의 합. 0보다 크면 SHORT */
  shortfall: number;
  /** 요건을 채우려면 확정해야 할 지난 방문 수 */
  toConfirm: number;
  /** 요건을 채우려면 마쳐야 할 예정 방문 수 */
  toVisit: number;
}

const emptyTallies = (): Record<Profession, HomeCareTally> => ({
  DOCTOR: { confirmed: 0, unconfirmedPast: 0, upcoming: 0 },
  NURSE: { confirmed: 0, unconfirmedPast: 0, upcoming: 0 },
  SOCIAL_WORKER: { confirmed: 0, unconfirmedPast: 0, upcoming: 0 },
});

/**
 * 판정한다. 모자란 방문은 달력 수급자 패널과 같은 규칙(homeCareMissing: 확정·미확정·예정을 모두
 * 더해도 요건에 모자란 수)이고, 나머지는 모자란 만큼을 확정 → 지난 미확정 → 예정 순서로 채워
 * 확정할 것·마칠 것을 센다.
 */
function judge<T>(
  recipient: T,
  tallies: Record<Profession, HomeCareTally>,
): HomeCareFeeStatus<T> {
  const planned = homeCarePlannedCounts(tallies);
  const missing = homeCareMissing(planned);
  const shortfall = homeCareShortfall(planned);
  let toConfirm = 0;
  let toVisit = 0;
  for (const profession of PROFESSIONS) {
    const { confirmed, unconfirmedPast, upcoming } = tallies[profession];
    const left = Math.max(0, HOME_CARE_MONTHLY_VISITS[profession] - confirmed);
    const fromPast = Math.min(unconfirmedPast, left);
    toConfirm += fromPast;
    toVisit += Math.min(upcoming, left - fromPast);
  }
  let verdict: HomeCareFeeVerdict = "SECURED";
  if (shortfall > 0) verdict = "SHORT";
  else if (toConfirm + toVisit > 0) verdict = "PENDING";
  return {
    recipient,
    tallies,
    verdict,
    missing,
    shortfall,
    toConfirm,
    toVisit,
  };
}

/**
 * 재택의료센터에 등록한 수급자마다 그달 기본료를 판정한다(방문이 없으면 모두 모자람).
 * items는 그달을 덮는 달력 항목이다(앞뒤 달 항목은 건너뛴다). today보다 앞선 날의 확정 안 된
 * 방문은 "지난 미확정"이다. 위험한 판정부터, 같으면 모자란 방문이 많은 수급자부터, 그다음은
 * 받은 순서 그대로다.
 */
export function homeCareFeeStatuses<
  T extends { id: string; programs: readonly Program[] },
>(
  recipients: readonly T[],
  items: readonly VisitCalendarItem[],
  month: string,
  today: string,
): HomeCareFeeStatus<T>[] {
  const byRecipient = new Map<string, Record<Profession, HomeCareTally>>();
  for (const item of items) {
    if (item.program !== "HOME_CARE_CENTER") continue;
    const date = kstDateInMonth(item, month);
    if (!date) continue;
    let tallies = byRecipient.get(item.recipient.id);
    if (!tallies) {
      tallies = emptyTallies();
      byRecipient.set(item.recipient.id, tallies);
    }
    const tally = tallies[item.profession];
    if (item.status === "CONFIRMED") tally.confirmed += 1;
    else if (date < today) tally.unconfirmedPast += 1;
    else tally.upcoming += 1;
  }
  return recipients
    .filter((recipient) => recipient.programs.includes("HOME_CARE_CENTER"))
    .map((recipient) =>
      judge(recipient, byRecipient.get(recipient.id) ?? emptyTallies()),
    )
    .sort(
      (a, b) =>
        HOME_CARE_FEE_VERDICTS.indexOf(a.verdict) -
          HOME_CARE_FEE_VERDICTS.indexOf(b.verdict) ||
        b.shortfall - a.shortfall,
    );
}

/** 판정별 수급자 수와 기본료 합계(원). */
export function homeCareFeeTotals(
  statuses: readonly HomeCareFeeStatus<unknown>[],
): Record<HomeCareFeeVerdict, { count: number; amount: number }> {
  const totals = Object.fromEntries(
    HOME_CARE_FEE_VERDICTS.map((verdict) => [verdict, { count: 0, amount: 0 }]),
  ) as Record<HomeCareFeeVerdict, { count: number; amount: number }>;
  for (const { verdict } of statuses) {
    totals[verdict].count += 1;
    totals[verdict].amount += HOME_CARE_BASE_FEE;
  }
  return totals;
}

/** 직종별로 확정·미확정·예정을 모두 더한 방문 수(요건 대비 표시용). */
export function homeCarePlannedCounts(
  tallies: Record<Profession, HomeCareTally>,
): HomeCareVisitCounts {
  const total = ({ confirmed, unconfirmedPast, upcoming }: HomeCareTally) =>
    confirmed + unconfirmedPast + upcoming;
  return {
    DOCTOR: total(tallies.DOCTOR),
    NURSE: total(tallies.NURSE),
    SOCIAL_WORKER: total(tallies.SOCIAL_WORKER),
  };
}

/** 그달 재택의료 급여비용 청구 마감(다음 달 10일, 한국 날짜). */
export function homeCareClaimDeadline(month: string): string {
  return `${addMonths(month, 1)}-10`;
}
