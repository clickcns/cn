import { z } from "zod";
import {
  addMonths,
  minutesBetween,
  monthOf,
  toKstIsoDateTime,
} from "./date.js";
import {
  selectedOptions,
  type FormId,
  type VisitForms,
} from "./forms/index.js";
import {
  checkHomeCareVisit,
  homeCareMonthPeriod,
  type ExternalServiceSchedule,
  type HomeCareAssessmentFact,
  type HomeCareCaseFacts,
} from "./home-care-case.js";
import type { HomeCareFeeStatus } from "./home-care-fee.js";
import { HOME_CARE_MONTHLY_VISITS } from "./programs.js";
import type { Recipient } from "./recipient.js";
import type { Profession } from "./roles.js";
import { isoMonthSchema } from "./schema.js";
import {
  emptyHomeCareCounts,
  homeCareShortfall,
  type VisitCalendarItem,
} from "./visit.js";

/*
 * 재택의료센터 그달 예상 수입(관리 웹 재택의료 수입). 기본료 판정(home-care-fee.ts) 위에
 * 방문진료료·추가간호료·지속관리료와 놓치기 쉬운 산정 조건을 더한다. 금액은 본인부담금을 포함한
 * 수가이고, 장기요양 재택의료센터 시범사업 지침(2026.2)·일차의료 방문진료 수가(의원)를 따른다.
 * 수가가 바뀌면 아래 상수만 고친다(화면 글도 이 상수로 만든다). 동반인력·야간 가산은 셈하지 않는다.
 */

/** 방문진료료Ⅰ(의원, 회). 재택의료센터 의사 방문을 제4호로 심평원에 청구할 때. */
export const HOME_CARE_VISIT_FEE = 131_720;
/** 제4호 "동일 건물 및 동일 세대 방문 여부"별 방문진료료 비율(동일 세대는 두 번째 환자부터). */
export const HOME_CARE_VISIT_FEE_RATES = {
  SAME_BUILDING: 0.75,
  SAME_HOUSEHOLD: 0.5,
} as const;
/** 추가간호료(회). 간호사 기본 방문(월 2회)을 넘는 방문, 월 3회까지, 30분 이상, 의사 동행 아님. */
export const HOME_CARE_EXTRA_NURSING_FEE = 53_770;
export const HOME_CARE_EXTRA_NURSING_MAX = 3;
export const HOME_CARE_EXTRA_NURSING_MIN_MINUTES = 30;
/** 지속관리료. 기본료를 6개월 연속 받을 때마다 수급자당 한 번. */
export const HOME_CARE_CONTINUITY_FEE = 60_000;
export const HOME_CARE_CONTINUITY_MONTHS = 6;
/** 의사 1인당 월 한도: 기본료 수급자 140명, 방문진료료 140회. */
export const HOME_CARE_DOCTOR_MONTHLY_LIMIT = 140;

/* ---------- 방문 하나에서 뽑는 사실 ---------- */

/**
 * 금액 셈이 읽는 서식 칸과 선택지. 서식 정의에서 칸이나 선택지가 바뀌면 테스트
 * (home-care-revenue.spec)가 알린다(돈이 소리 없이 바뀌지 않게).
 */
export const HOME_CARE_REVENUE_FIELDS = {
  /** 제4호 동일 건물·세대 → 방문진료료 비율 */
  sameBuilding: {
    formId: "PRIMARY_CARE_CHECK",
    key: "sameBuilding",
    values: Object.keys(HOME_CARE_VISIT_FEE_RATES),
  },
  /** 제7호 방문사유 */
  visitType: {
    formId: "HOME_CARE_NURSE",
    key: "visitType",
    values: ["REGULAR", "ADDITIONAL"],
  },
  /** 제7호 동행자 */
  companion: {
    formId: "HOME_CARE_NURSE",
    key: "companion",
    values: ["DOCTOR"],
  },
  /** 제8호 상담 내용(방문일정 조율뿐이면 단순 안부확인) */
  content: { formId: "HOME_CARE_SOCIAL", key: "content", values: ["SCHEDULE"] },
} as const satisfies Record<
  string,
  { formId: FormId; key: string; values: readonly string[] }
>;
type RevenueField =
  (typeof HOME_CARE_REVENUE_FIELDS)[keyof typeof HOME_CARE_REVENUE_FIELDS];

/** 금액 셈에 쓰는 서식(서버가 이 서식의 값만 읽는다). */
export const HOME_CARE_REVENUE_FORM_IDS: FormId[] = [
  ...new Set(
    Object.values(HOME_CARE_REVENUE_FIELDS).map((field) => field.formId),
  ),
];

/** 금액 셈에 쓰는 방문의 사실. 서버가 서식 값에서 뽑아 보낸다(서식 값 전체는 보내지 않는다). */
export interface HomeCareVisitFacts {
  /** 의사 방문을 제4호로 청구하면 방문진료료 비율(1·0.75·0.5), 아니면 null */
  visitFeeRate: number | null;
  /** 제7호 방문사유(정기·추가). 아직 적지 않았으면 null */
  nurseVisitType: "REGULAR" | "ADDITIONAL" | null;
  /** 제7호 동행자에 의사가 있다 */
  withDoctor: boolean;
  /** 방문 시작~종료(분). 시각을 적지 않았으면 null */
  minutes: number | null;
  /** 제8호 상담 내용이 방문일정 조율뿐이다(단순 안부확인) */
  scheduleOnly: boolean;
}

const valuesOf = (forms: VisitForms, field: RevenueField) =>
  selectedOptions(forms[field.formId], field.key).map((option) => option.value);

const visitFeeRates: Readonly<Record<string, number>> =
  HOME_CARE_VISIT_FEE_RATES;

export function homeCareVisitFacts(visit: {
  profession: Profession;
  formIds: readonly FormId[];
  startedAt: string | null;
  endedAt: string | null;
  forms: VisitForms;
}): HomeCareVisitFacts {
  const { forms } = visit;
  const fields = HOME_CARE_REVENUE_FIELDS;
  const [sameBuilding = ""] = valuesOf(forms, fields.sameBuilding);
  const [visitType] = valuesOf(forms, fields.visitType);
  const content = valuesOf(forms, fields.content);
  return {
    visitFeeRate:
      visit.profession === "DOCTOR" &&
      visit.formIds.includes(fields.sameBuilding.formId)
        ? (visitFeeRates[sameBuilding] ?? 1)
        : null,
    nurseVisitType:
      visitType === "REGULAR" || visitType === "ADDITIONAL" ? visitType : null,
    withDoctor: valuesOf(forms, fields.companion).includes("DOCTOR"),
    minutes:
      visit.startedAt && visit.endedAt
        ? minutesBetween(visit.startedAt, visit.endedAt)
        : null,
    scheduleOnly:
      content.length > 0 && content.every((value) => value === "SCHEDULE"),
  };
}

/* ---------- API ---------- */

/** 그달 재택의료센터 방문 하나(모든 상태). 시작·종료는 다른 기관 서비스와 시간이 겹치는지 볼 때 쓴다. */
export interface HomeCareMonthVisit extends VisitCalendarItem {
  startedAt: string | null;
  endedAt: string | null;
  facts: HomeCareVisitFacts;
}

/** 재택의료 수입의 수급자: 판정에 쓰는 사례 정보(포괄평가·종결·다른 기관 서비스)를 함께 싣는다. */
export interface HomeCareRecipient
  extends
    Pick<
      Recipient,
      "id" | "organizationId" | "name" | "careGrade" | "programs" | "isActive"
    >,
    HomeCareCaseFacts {
  assessments: HomeCareAssessmentFact[];
  /** 기관 밖 서비스와, 같은 기관의 그달 장기요양 방문간호 날(ownLtcNursingDay) */
  externalServices: ExternalServiceSchedule[];
}

export interface HomeCareMonthResponse {
  /** 방문이 상한(VISIT_CALENDAR_MAX_ITEMS)을 넘으면 null(운영자의 전체 기관 보기, 수급자도 비운다) */
  visits: HomeCareMonthVisit[] | null;
  /** 재택의료센터 수급자 중 사용 중이거나 그달 방문이 있고, 그달 전에 종결하지 않은 수급자 */
  recipients: HomeCareRecipient[];
  /** 수급자 id → 그달 직전까지 기본료 요건을 확정 기록으로 이어서 채운 달 수(0이면 뺀다) */
  priorStreaks: Record<string, number>;
}

export const HomeCareMonthQuerySchema = z.object({
  month: isoMonthSchema,
  organizationId: z.uuid().optional(),
});
export type HomeCareMonthQuery = z.input<typeof HomeCareMonthQuerySchema>;

/** 그달 전 확정 방문을 수급자·한국 날짜·직종별로 센 줄. */
export interface HomeCareConfirmedCount {
  recipientId: string;
  date: string;
  profession: Profession;
  count: number;
}

/**
 * factsOf의 수급자마다 그달 직전부터 거슬러 기본료 요건을 채운 달이 몇 달 이어지는지. 달마다 이달
 * 판정과 같은 산정 기간(homeCareMonthPeriod: 포괄평가 전·기한 지남은 채우지 못한 달)과 방문
 * 세기(checkHomeCareVisit — 날짜만 알므로 이용 시간이 겹칠 때만 해당하는 서비스는 빼지 않는다),
 * 요건(homeCareShortfall)으로 본다.
 */
export function homeCarePriorStreaks(
  counts: readonly HomeCareConfirmedCount[],
  month: string,
  factsOf: ReadonlyMap<string, HomeCareCaseFacts>,
): Record<string, number> {
  const byRecipient = new Map<string, Map<string, HomeCareConfirmedCount[]>>();
  for (const row of counts) {
    let months = byRecipient.get(row.recipientId);
    if (!months) {
      months = new Map();
      byRecipient.set(row.recipientId, months);
    }
    const rowMonth = monthOf(row.date);
    const rows = months.get(rowMonth);
    if (rows) rows.push(row);
    else months.set(rowMonth, [row]);
  }
  const streaks: Record<string, number> = {};
  for (const [recipientId, facts] of factsOf) {
    const months = byRecipient.get(recipientId);
    if (!months) continue;
    const secured = (previous: string) => {
      const rows = months.get(previous);
      if (!rows) return false;
      const period = homeCareMonthPeriod(facts, previous);
      if (period.block) return false;
      const tally = emptyHomeCareCounts();
      for (const row of rows) {
        const visit = {
          profession: row.profession,
          scheduledAt: toKstIsoDateTime(row.date, "00:00"),
          timeUnknown: true,
        };
        if (
          checkHomeCareVisit(period, facts.externalServices, visit, row.date)
            .counted
        ) {
          tally[row.profession] += row.count;
        }
      }
      return homeCareShortfall(tally) === 0;
    };
    let streak = 0;
    for (
      let previous = addMonths(month, -1);
      secured(previous);
      previous = addMonths(previous, -1)
    ) {
      streak += 1;
    }
    if (streak > 0) streaks[recipientId] = streak;
  }
  return streaks;
}

/* ---------- 수급자 한 명 ---------- */

/** 예상 수입 항목(화면 순서). */
export const HOME_CARE_REVENUE_PARTS = [
  "base",
  "visitFee",
  "extraNursing",
  "continuity",
] as const;
export type HomeCareRevenuePart = (typeof HOME_CARE_REVENUE_PARTS)[number];

/** 항목 이름·줄임말과 건수 단위(기본료·지속관리료는 수급자, 방문진료료·추가간호료는 방문). */
export const HOME_CARE_REVENUE_PART_INFO: Record<
  HomeCareRevenuePart,
  { label: string; short: string; unit: string }
> = {
  base: { label: "기본료", short: "기본", unit: "명" },
  visitFee: { label: "방문진료료", short: "진료", unit: "회" },
  extraNursing: { label: "추가간호료", short: "추가", unit: "회" },
  continuity: { label: "지속관리료", short: "지속", unit: "명" },
};

type RevenueParts = Record<
  HomeCareRevenuePart,
  { count: number; amount: number }
>;

export interface HomeCareRevenue {
  parts: RevenueParts;
  total: number;
  /** 그달까지 기본료 연속 개월(그달이 방문 부족이면 0). 6의 배수인 달에 지속관리료 */
  streak: number;
  /** 놓치기 쉬운 산정 조건(받지 못하는 방문, 끊기는 연속 등) */
  issues: string[];
}

function visitFee(visits: readonly HomeCareMonthVisit[]) {
  let count = 0;
  let amount = 0;
  for (const { facts } of visits) {
    if (facts.visitFeeRate === null) continue;
    count += 1;
    amount += Math.round(HOME_CARE_VISIT_FEE * facts.visitFeeRate);
  }
  return { count, amount };
}

/**
 * 추가간호료: 간호사 방문 중 기본 2회를 넘는 방문을, 정기로 적지 않았고 의사 동행이 아니며 30분
 * 이상인 방문 수와 월 3회 중 작은 만큼 받는다. 방문사유를 아직 적지 않은 방문(예정 등)은 추가로
 * 적을 수 있는 방문으로 본다. 받지 못하는 까닭(추가로 적은 방문만)은 issues로 돌려준다.
 */
function extraNursing(visits: readonly HomeCareMonthVisit[]) {
  const nurseVisits = visits.filter((visit) => visit.profession === "NURSE");
  const beyondBasic = Math.max(
    0,
    nurseVisits.length - HOME_CARE_MONTHLY_VISITS.NURSE,
  );
  let regular = 0;
  let withDoctor = 0;
  let tooShort = 0;
  let eligible = 0;
  for (const { facts } of nurseVisits) {
    const additional = facts.nurseVisitType === "ADDITIONAL";
    if (facts.nurseVisitType === "REGULAR") regular += 1;
    else if (facts.withDoctor) {
      if (additional) withDoctor += 1;
    } else if (
      facts.minutes !== null &&
      facts.minutes < HOME_CARE_EXTRA_NURSING_MIN_MINUTES
    ) {
      if (additional) tooShort += 1;
    } else eligible += 1;
  }
  const count = Math.min(HOME_CARE_EXTRA_NURSING_MAX, eligible, beyondBasic);
  const over = Math.min(eligible, beyondBasic) - HOME_CARE_EXTRA_NURSING_MAX;
  const issues = [
    regular > HOME_CARE_MONTHLY_VISITS.NURSE &&
      `간호사 정기 방문이 ${regular}회로 적혀 있습니다. 기본 ${HOME_CARE_MONTHLY_VISITS.NURSE}회를 넘는 방문은 방문사유를 추가 방문으로 적어야 추가간호료를 받습니다`,
    withDoctor > 0 &&
      `의사와 동행한 추가 방문 ${withDoctor}건은 추가간호료를 받지 않습니다`,
    tooShort > 0 &&
      `${HOME_CARE_EXTRA_NURSING_MIN_MINUTES}분이 안 된 추가 방문 ${tooShort}건은 추가간호료를 받지 않습니다`,
    over > 0 &&
      `추가간호료는 월 ${HOME_CARE_EXTRA_NURSING_MAX}회까지라 ${over}건은 받지 않습니다`,
  ].filter((issue) => issue !== false);
  return { count, amount: count * HOME_CARE_EXTRA_NURSING_FEE, issues };
}

/**
 * 수급자 한 명의 그달 예상 수입. visits는 그 수급자의 그달 재택의료센터 방문(모든 상태)이다.
 * 예정·미확정 방문도 마치고 확정하면 받을 금액으로 넣는다. 기본료는 판정이 방문 부족·포괄평가
 * 필요면 0, 아니면 판정의 fee(사망 종결 50% 포함)다. 포괄평가 필요(막힘)면 장기요양 재택의료
 * 급여(기본료·추가간호료·지속관리료)는 없고 건강보험 방문진료료만 받는다. 추가간호료는 기본료
 * 횟수에 넣은 방문(countedVisitIds)으로 센다.
 */
export function homeCareRevenue(
  status: Pick<
    HomeCareFeeStatus<unknown>,
    "verdict" | "fee" | "halfFee" | "countedVisitIds"
  >,
  visits: readonly HomeCareMonthVisit[],
  priorStreak: number,
): HomeCareRevenue {
  const blocked = status.verdict === "BLOCKED";
  const payable = !blocked && status.verdict !== "SHORT";
  const counted = visits.filter((visit) =>
    status.countedVisitIds.has(visit.id),
  );
  const { issues, ...extra } = extraNursing(blocked ? [] : counted);
  const social = counted.filter(
    (visit) => visit.profession === "SOCIAL_WORKER",
  );
  if (social.length > 0 && social.every((visit) => visit.facts.scheduleOnly)) {
    issues.push(
      "사회복지사 상담 내용이 방문일정 조율뿐입니다. 단순 안부확인은 기본료 상담으로 인정되지 않습니다",
    );
  }
  if (!payable && priorStreak > 0) {
    issues.push(
      `기본료를 놓치면 ${priorStreak}개월 이어 온 연속이 끊깁니다(지속관리료는 ${HOME_CARE_CONTINUITY_MONTHS}개월 연속마다)`,
    );
  }
  const streak = payable ? priorStreak + 1 : 0;
  // 사망 종결로 기본료 50%를 받는 달은 지속관리료를 산정하지 않는다.
  const due =
    !status.halfFee && streak > 0 && streak % HOME_CARE_CONTINUITY_MONTHS === 0;
  const parts: RevenueParts = {
    base: { count: payable ? 1 : 0, amount: payable ? status.fee : 0 },
    visitFee: visitFee(visits),
    extraNursing: extra,
    continuity: {
      count: due ? 1 : 0,
      amount: due ? HOME_CARE_CONTINUITY_FEE : 0,
    },
  };
  return { parts, total: sumParts(parts), streak, issues };
}

const sumParts = (parts: RevenueParts) =>
  HOME_CARE_REVENUE_PARTS.reduce((sum, part) => sum + parts[part].amount, 0);

/* ---------- 기관 한 달 ---------- */

export interface HomeCareMonthRevenue {
  /** 수급자 id → 예상 수입 */
  byRecipient: Map<string, HomeCareRevenue>;
  /** 항목별 합(건수·금액)과 총액 */
  totals: Pick<HomeCareRevenue, "parts" | "total">;
  /** 기관 단위 경고(의사 1인당 한도) */
  warnings: string[];
}

/**
 * 판정한 수급자마다 그달 예상 수입을 내고 합한다. visits는 그달 재택의료센터 방문(API가 그달만
 * 준다), priorStreaks는 수급자별 직전 연속 개월이다.
 */
export function homeCareMonthRevenue(
  statuses: readonly HomeCareFeeStatus<{ id: string }>[],
  visits: readonly HomeCareMonthVisit[],
  priorStreaks: Readonly<Record<string, number>>,
): HomeCareMonthRevenue {
  const visitsOf = new Map<string, HomeCareMonthVisit[]>();
  for (const visit of visits) {
    const list = visitsOf.get(visit.recipient.id);
    if (list) list.push(visit);
    else visitsOf.set(visit.recipient.id, [visit]);
  }
  const byRecipient = new Map<string, HomeCareRevenue>();
  const parts = Object.fromEntries(
    HOME_CARE_REVENUE_PARTS.map((part) => [part, { count: 0, amount: 0 }]),
  ) as RevenueParts;
  for (const status of statuses) {
    const { recipient } = status;
    const revenue = homeCareRevenue(
      status,
      visitsOf.get(recipient.id) ?? [],
      priorStreaks[recipient.id] ?? 0,
    );
    byRecipient.set(recipient.id, revenue);
    for (const part of HOME_CARE_REVENUE_PARTS) {
      parts[part].count += revenue.parts[part].count;
      parts[part].amount += revenue.parts[part].amount;
    }
  }
  return {
    byRecipient,
    totals: { parts, total: sumParts(parts) },
    warnings: doctorLimitWarnings(visits),
  };
}

/** 의사 1인당 월 기본료 140명·방문진료료 140회를 넘으면 넘는 만큼은 받지 못한다. */
function doctorLimitWarnings(visits: readonly HomeCareMonthVisit[]): string[] {
  const doctors = new Map<
    string,
    { name: string; recipients: Set<string>; billed: number }
  >();
  for (const visit of visits) {
    if (visit.profession !== "DOCTOR") continue;
    let doctor = doctors.get(visit.staff.id);
    if (!doctor) {
      doctor = { name: visit.staff.name, recipients: new Set(), billed: 0 };
      doctors.set(visit.staff.id, doctor);
    }
    doctor.recipients.add(visit.recipient.id);
    if (visit.facts.visitFeeRate !== null) doctor.billed += 1;
  }
  const warnings: string[] = [];
  for (const { name, recipients, billed } of doctors.values()) {
    if (recipients.size > HOME_CARE_DOCTOR_MONTHLY_LIMIT) {
      warnings.push(
        `${name} 의사의 이달 수급자가 ${recipients.size}명입니다. 기본료는 의사 1인당 ${HOME_CARE_DOCTOR_MONTHLY_LIMIT}명까지입니다`,
      );
    }
    if (billed > HOME_CARE_DOCTOR_MONTHLY_LIMIT) {
      warnings.push(
        `${name} 의사의 이달 방문진료료 청구가 ${billed}회입니다. 의사 1인당 월 ${HOME_CARE_DOCTOR_MONTHLY_LIMIT}회까지입니다`,
      );
    }
  }
  return warnings;
}
