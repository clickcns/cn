import { addMonths, formatDateLabel, monthOf } from "./date.js";
import type { HomeCareFees } from "./fee-schedule.js";
import {
  checkHomeCareVisit,
  externalConflictText,
  homeCareMonthPeriod,
  type HomeCareCaseFacts,
  type HomeCareMonthPeriod,
} from "./home-care-case.js";
import { HOME_CARE_MONTHLY_VISITS, type Program } from "./programs.js";
import { PROFESSION_LABELS, PROFESSIONS, type Profession } from "./roles.js";
import { withParticle } from "./text.js";
import {
  emptyHomeCareCounts,
  homeCareMissing,
  homeCareShortfall,
  kstDateInMonth,
  type HomeCareVisitCounts,
  type VisitCalendarItem,
} from "./visit.js";

/*
 * 재택의료기본료 판정(장기요양 재택의료센터 시범사업 지침 2026.2, 13쪽).
 * 수급자당 월 1회, 그달 산정 기간에 의사 1회·간호사 2회·사회복지사 상담 1회를 모두 채워야 산정한다.
 * 하나라도 빠지면 그달 기본료는 0원이다. 의사·간호사가 함께 방문하면 각각 센다(방문 한 건이
 * 방문한 직종 하나로 세어지므로 그대로 맞다). 방문 직종은 담당자의 지금 직종이 아니라
 * 방문에 저장한 직종(profession)이다.
 * 산정 기간·막힘(포괄평가 전·재평가 기한 지남)·종결은 home-care-case.ts의 homeCareMonthPeriod,
 * 같은 날 다른 기관 서비스가 있어 산정하지 않는 방문은 externalConflicts가 정한다.
 * 기본료 금액·사망 종결 비율은 그달 수가 묶음(fee-schedule.ts의 HomeCareFees, 관리 웹 [수가 관리])이다.
 * 방문진료료·추가간호료·지속관리료와 의사 1인당 한도는 home-care-revenue.ts가 이 판정 위에 더한다.
 * 아직 보지 않는 규칙: 케어플랜 없는 긴급왕진 제외.
 */

/** 이달 재택의료 방문 중 한 직종의 건수. */
export interface HomeCareTally {
  confirmed: number;
  /** 지난 날짜인데 확정하지 않은 방문(예정·작성 중) */
  unconfirmedPast: number;
  /** 오늘부터의 예정·작성 중 방문 */
  upcoming: number;
}

/**
 * 위험한 것부터: 포괄평가 전·재평가 기한이 지나 산정하지 않음 → 지금 일정으로는 못 채움 → 남은
 * 방문·확정을 마치면 채움 → 확정 기록으로 채움.
 */
export const HOME_CARE_FEE_VERDICTS = [
  "BLOCKED",
  "SHORT",
  "PENDING",
  "SECURED",
] as const;
export type HomeCareFeeVerdict = (typeof HOME_CARE_FEE_VERDICTS)[number];

export const HOME_CARE_FEE_VERDICT_LABELS: Record<HomeCareFeeVerdict, string> =
  {
    BLOCKED: "포괄평가 필요",
    SHORT: "방문 부족",
    PENDING: "확정 남음",
    SECURED: "확보",
  };

/** 지금 일정·기록으로는 기본료를 받지 못하는 판정(현황판·표의 "기본료 위험"). */
export function isFeeAtRisk(verdict: HomeCareFeeVerdict): boolean {
  return verdict === "BLOCKED" || verdict === "SHORT";
}

/** 판정에 쓰는 방문(달력 항목 또는 재택의료 수입 API의 방문). */
export type HomeCareFeeVisit = Pick<
  VisitCalendarItem,
  "id" | "program" | "status" | "scheduledAt" | "profession"
> & {
  recipient: { id: string };
  startedAt?: string | null;
  endedAt?: string | null;
};

/** 재택의료센터 수급자 한 명의 그달 기본료 판정. */
export interface HomeCareFeeStatus<T> {
  recipient: T;
  /** 요건을 세는 기간과 막힘·종결 */
  period: HomeCareMonthPeriod;
  tallies: Record<Profession, HomeCareTally>;
  verdict: HomeCareFeeVerdict;
  /** 직종별로 더 잡아야 할 방문(예정·미확정을 모두 마쳐도 모자란 수) */
  missing: HomeCareVisitCounts;
  /** missing의 합. 0보다 크면 SHORT(막힘이 아니면) */
  shortfall: number;
  /** 요건을 채우려면 확정해야 할 지난 방문 수 */
  toConfirm: number;
  /** 요건을 채우려면 마쳐야 할 예정 방문 수 */
  toVisit: number;
  /** 이 판정이 걸린 기본료(보통 14만원, halfFee면 50%) */
  fee: number;
  /** 방문한 뒤 사망해 요건을 못 채운 달(기본료 50%, 지속관리료 없음) */
  halfFee: boolean;
  /** 기본료 횟수에 넣은 방문(추가간호료도 이 방문으로 센다) */
  countedVisitIds: ReadonlySet<string>;
  /** 판정에서 알아 둘 것(빼고 센 방문, 시간에 따라 산정하지 않을 수 있는 방문, 막힘·종결·재평가 기간) */
  notes: string[];
}

const emptyTallies = (): Record<Profession, HomeCareTally> => ({
  DOCTOR: { confirmed: 0, unconfirmedPast: 0, upcoming: 0 },
  NURSE: { confirmed: 0, unconfirmedPast: 0, upcoming: 0 },
  SOCIAL_WORKER: { confirmed: 0, unconfirmedPast: 0, upcoming: 0 },
});

/** 그달 방문 한 건과 그 한국 날짜. */
interface DatedVisit {
  visit: HomeCareFeeVisit;
  date: string;
}

/** 확정·미확정·예정 건수에서 모자란 방문과 확정할 것·마칠 것, 그 판정. */
function tallyVerdict(tallies: Record<Profession, HomeCareTally>) {
  const planned = homeCarePlannedCounts(tallies);
  let toConfirm = 0;
  let toVisit = 0;
  for (const profession of PROFESSIONS) {
    const { confirmed, unconfirmedPast, upcoming } = tallies[profession];
    const left = Math.max(0, HOME_CARE_MONTHLY_VISITS[profession] - confirmed);
    const fromPast = Math.min(unconfirmedPast, left);
    toConfirm += fromPast;
    toVisit += Math.min(upcoming, left - fromPast);
  }
  const shortfall = homeCareShortfall(planned);
  let verdict: HomeCareFeeVerdict = "SECURED";
  if (shortfall > 0) verdict = "SHORT";
  else if (toConfirm + toVisit > 0) verdict = "PENDING";
  return {
    verdict,
    missing: homeCareMissing(planned),
    shortfall,
    toConfirm,
    toVisit,
  };
}

/**
 * 수급자 한 명을 판정한다. 산정 기간 안의 방문 중 같은 날 다른 기관 서비스가 있어 산정하지 않는
 * 방문을 빼고(checkHomeCareVisit), 직종별로 확정·지난 미확정·예정으로 센다. 모자란 방문은 달력
 * 수급자 패널과 같은 규칙(homeCareMissing: 확정·미확정·예정을 모두 더해도 요건에 모자란 수)이고,
 * 나머지는 모자란 만큼을 확정 → 지난 미확정 → 예정 순서로 채워 확정할 것·마칠 것을 센다.
 * 막힌 달은 포괄평가 필요, 팀이 방문한 뒤 사망해 요건을 못 채운 달은 기본료 50%다.
 */
function judge<T extends HomeCareCaseFacts>(
  recipient: T,
  visits: readonly DatedVisit[],
  month: string,
  today: string,
  fees: HomeCareFees,
): HomeCareFeeStatus<T> {
  const period = homeCareMonthPeriod(recipient, month);
  const tallies = emptyTallies();
  const countedVisitIds = new Set<string>();
  const notes: string[] = [];
  let beforePeriod = 0;
  let afterEnd = 0;
  for (const { visit, date } of visits) {
    const check = checkHomeCareVisit(
      period,
      recipient.externalServices,
      visit,
      date,
    );
    const label = `${formatDateLabel(date)} ${PROFESSION_LABELS[visit.profession]} 방문`;
    if (!check.counted) {
      if (check.reason === "BEFORE_PERIOD") beforePeriod += 1;
      else if (check.reason === "AFTER_END") afterEnd += 1;
      else if (check.reason === "EXTERNAL") {
        notes.push(
          `${label}: ${externalConflictText(check.conflict)}(횟수에서 뺌)`,
        );
      }
      continue;
    }
    for (const caution of check.cautions) {
      notes.push(`${label}: ${externalConflictText(caution)}`);
    }
    countedVisitIds.add(visit.id);
    const tally = tallies[visit.profession];
    if (visit.status === "CONFIRMED") tally.confirmed += 1;
    else if (date < today) tally.unconfirmedPast += 1;
    else tally.upcoming += 1;
  }
  if (beforePeriod > 0) {
    notes.push(
      `포괄평가일 ${formatDateLabel(period.from)} 전 방문 ${beforePeriod}건은 기본료 횟수에 넣지 않았습니다`,
    );
  }
  if (period.ended && afterEnd > 0) {
    notes.push(
      `종결일 ${formatDateLabel(period.ended.on)} 뒤 방문 ${afterEnd}건은 세지 않습니다`,
    );
  }
  if (
    !period.block &&
    !period.ended &&
    period.assessment &&
    period.assessment.from <= period.to &&
    monthOf(period.assessment.deadline) >= month
  ) {
    notes.push(
      `재평가 기간입니다. ${formatDateLabel(period.assessment.deadline)}까지 재평가하지 않으면 재택의료 급여를 산정하지 않습니다`,
    );
  }

  const counted = tallyVerdict(tallies);
  const status = {
    recipient,
    period,
    tallies,
    ...counted,
    fee: fees.baseFee,
    halfFee: false,
    countedVisitIds,
    notes,
  };
  if (period.block) {
    notes.unshift(
      period.block === "LAPSED" && period.assessment
        ? `재평가 기한 ${withParticle(formatDateLabel(period.assessment.deadline), "이/가")} 지나 재택의료 급여를 산정하지 않습니다. 포괄평가를 하고 기록하면 그날부터 셉니다`
        : "최초 포괄평가 전 달이라 재택의료 급여를 산정하지 않습니다",
    );
    return { ...status, verdict: "BLOCKED" };
  }
  if (
    period.ended?.reason === "DEATH" &&
    counted.shortfall > 0 &&
    countedVisitIds.size > 0
  ) {
    // 팀이 한 번이라도 방문한 뒤 사망해 요건을 채우지 못했으면 기본료의 50%(그 방문을 확정하면 확보).
    // 더 잡을 방문은 없다.
    notes.unshift(
      `${formatDateLabel(period.ended.on)} 사망 종결로 요건을 채우지 못해 기본료의 ${fees.deathFeePercent}%를 받습니다`,
    );
    const confirmed = PROFESSIONS.some(
      (profession) => tallies[profession].confirmed > 0,
    );
    return {
      ...status,
      verdict: confirmed ? "SECURED" : "PENDING",
      missing: emptyHomeCareCounts(),
      shortfall: 0,
      toConfirm: confirmed ? 0 : 1,
      toVisit: 0,
      fee: Math.round((fees.baseFee * fees.deathFeePercent) / 100),
      halfFee: true,
    };
  }
  return status;
}

/**
 * 재택의료센터에 등록한 수급자마다 그달 기본료를 판정한다(방문이 없으면 모두 모자람).
 * visits는 그달을 덮는 방문이다(앞뒤 달·다른 사업은 건너뛴다). today보다 앞선 날의 확정 안 된
 * 방문은 "지난 미확정"이다. 포괄평가를 기록하지 않은 수급자는 달 전체를 센다. 위험한 판정부터, 같으면 모자란 방문이 많은 수급자부터, 그다음은 받은 순서 그대로다.
 */
export function homeCareFeeStatuses<
  T extends { id: string; programs: readonly Program[] } & HomeCareCaseFacts,
>(
  recipients: readonly T[],
  visits: readonly HomeCareFeeVisit[],
  month: string,
  today: string,
  fees: HomeCareFees,
): HomeCareFeeStatus<T>[] {
  const byRecipient = new Map<string, DatedVisit[]>();
  for (const visit of visits) {
    if (visit.program !== "HOME_CARE_CENTER") continue;
    const date = kstDateInMonth(visit, month);
    if (!date) continue;
    const list = byRecipient.get(visit.recipient.id);
    if (list) list.push({ visit, date });
    else byRecipient.set(visit.recipient.id, [{ visit, date }]);
  }
  return recipients
    .filter((recipient) => recipient.programs.includes("HOME_CARE_CENTER"))
    .map((recipient) =>
      judge(recipient, byRecipient.get(recipient.id) ?? [], month, today, fees),
    )
    .sort(
      (a, b) =>
        HOME_CARE_FEE_VERDICTS.indexOf(a.verdict) -
          HOME_CARE_FEE_VERDICTS.indexOf(b.verdict) ||
        b.shortfall - a.shortfall,
    );
}

/** 판정별 수급자 수와 걸린 기본료 합계(원). */
export function homeCareFeeTotals(
  statuses: readonly HomeCareFeeStatus<unknown>[],
): Record<HomeCareFeeVerdict, { count: number; amount: number }> {
  const totals = Object.fromEntries(
    HOME_CARE_FEE_VERDICTS.map((verdict) => [verdict, { count: 0, amount: 0 }]),
  ) as Record<HomeCareFeeVerdict, { count: number; amount: number }>;
  for (const { verdict, fee } of statuses) {
    totals[verdict].count += 1;
    totals[verdict].amount += fee;
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
