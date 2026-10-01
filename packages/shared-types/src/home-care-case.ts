import { z } from "zod";
import {
  addMonths,
  formatKstDate,
  formatKstTime,
  HHMM_REGEX,
  monthLastDay,
  monthOf,
  WEEKDAY_LABELS,
  weekdayIndex,
} from "./date.js";
import { PROFESSIONS, type Profession } from "./roles.js";
import { blankToNull, optionalText } from "./schema.js";
import { withParticle } from "./text.js";

/*
 * 재택의료센터 수급자의 사례 정보(장기요양 재택의료센터 시범사업 지침 2026.2): 포괄평가 기록,
 * 재택의료 종결, 같은 날 함께 있으면 재택의료 급여를 산정하지 않는 다른 기관 서비스. 기본료 판정
 * (home-care-fee.ts)이 그달 산정 기간·막힘·사망 50%·빼는 방문을 여기서 얻는다.
 */

/* ---------- 포괄평가 ---------- */

export const HOME_CARE_ASSESSMENT_KINDS = ["INITIAL", "REASSESS"] as const;
export type HomeCareAssessmentKind =
  (typeof HOME_CARE_ASSESSMENT_KINDS)[number];

export const HOME_CARE_ASSESSMENT_KIND_LABELS: Record<
  HomeCareAssessmentKind,
  string
> = {
  INITIAL: "최초 평가",
  REASSESS: "재평가",
};

/** 판정에 쓰는 포괄평가 한 건. */
export interface HomeCareAssessmentFact {
  /** 평가한 날(한국 날짜) */
  assessedOn: string;
  kind: HomeCareAssessmentKind;
}

export interface HomeCareAssessment extends HomeCareAssessmentFact {
  id: string;
  note: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export const CreateHomeCareAssessmentSchema = z.object({
  assessedOn: z.iso
    .date("평가한 날짜 형식이 올바르지 않습니다")
    .refine(
      (date) => date <= formatKstDate(),
      "평가한 날짜는 오늘보다 뒤일 수 없습니다",
    ),
  kind: z.enum(HOME_CARE_ASSESSMENT_KINDS, "최초 평가·재평가를 골라 주세요"),
  note: optionalText(200, "메모"),
});
export type CreateHomeCareAssessmentInput = z.input<
  typeof CreateHomeCareAssessmentSchema
>;

/**
 * 더하려는 포괄평가가 기록 순서에 맞는지: 재평가는 처음 최초 평가보다 뒤의 날이어야 한다(시설에서
 * 돌아와 다시 등록하면 최초 평가를 또 적는다). 맞으면 null, 아니면 까닭.
 */
export function assessmentOrderError(
  existing: readonly HomeCareAssessmentFact[],
  next: HomeCareAssessmentFact,
): string | null {
  const [firstInitial] = existing
    .filter((item) => item.kind === "INITIAL")
    .map((item) => item.assessedOn)
    .sort();
  return next.kind === "REASSESS" &&
    firstInitial !== undefined &&
    next.assessedOn < firstInitial
    ? "재평가는 최초 평가보다 뒤의 날이어야 합니다"
    : null;
}

/**
 * 다음 재평가 기간: 평가한 달의 12개월 뒤 1일부터 13개월 뒤 말일까지(지침 15~16쪽, 기한 안에
 * 하지 않으면 급여비용을 산정하지 않는다). 예: '26.1.11. 평가 → '27.1.1. ~ 2.28.
 */
export function reassessmentWindow(assessedOn: string): {
  from: string;
  deadline: string;
} {
  const month = monthOf(assessedOn);
  return {
    from: `${addMonths(month, 12)}-01`,
    deadline: monthLastDay(addMonths(month, 13)),
  };
}

/* ---------- 재택의료 종결 ---------- */

export const HOME_CARE_END_REASONS = ["DEATH", "FACILITY", "OTHER"] as const;
export type HomeCareEndReason = (typeof HOME_CARE_END_REASONS)[number];

export const HOME_CARE_END_REASON_LABELS: Record<HomeCareEndReason, string> = {
  DEATH: "사망",
  FACILITY: "시설 입소",
  OTHER: "기타(중단·이사 등)",
};

/** 종결 날짜와 사유를 함께 적거나 함께 지운다(null). */
export const SetHomeCareEndSchema = z
  .object({
    endedOn: z.iso.date("종결 날짜 형식이 올바르지 않습니다").nullable(),
    reason: z.enum(HOME_CARE_END_REASONS, "종결 사유를 골라 주세요").nullable(),
  })
  .refine((value) => (value.endedOn === null) === (value.reason === null), {
    message: "종결 날짜와 사유를 함께 적어 주세요",
    path: ["reason"],
  });
export type SetHomeCareEndInput = z.input<typeof SetHomeCareEndSchema>;

/* ---------- 다른 기관 서비스 ---------- */

/**
 * 같은 날(또는 같은 시간) 함께 있으면 재택의료 급여를 산정하지 않는 서비스(지침 14~15쪽 바.).
 * professions는 겹치면 안 되는 재택의료팀 직종, timed는 이용 시간이 겹칠 때만 해당하는 서비스다.
 */
export const EXTERNAL_SERVICE_KINDS = [
  "LTC_NURSING",
  "HOME_NURSING",
  "DAY_CARE",
  "BATH",
  "SHORT_STAY",
  "FACILITY",
  "LTC_SOCIAL_WORKER",
  "CHRONIC_CARE",
  "DISABILITY_DOCTOR",
] as const;
export type ExternalServiceKind = (typeof EXTERNAL_SERVICE_KINDS)[number];

export const EXTERNAL_SERVICE_INFO: Record<
  ExternalServiceKind,
  { label: string; professions: readonly Profession[]; timed: boolean }
> = {
  LTC_NURSING: {
    label: "장기요양 방문간호",
    professions: ["NURSE"],
    timed: false,
  },
  HOME_NURSING: {
    label: "가정간호(건강보험)",
    professions: ["NURSE"],
    timed: false,
  },
  DAY_CARE: { label: "주야간보호", professions: PROFESSIONS, timed: true },
  BATH: { label: "방문목욕", professions: PROFESSIONS, timed: true },
  SHORT_STAY: { label: "단기보호", professions: PROFESSIONS, timed: false },
  FACILITY: { label: "시설급여", professions: PROFESSIONS, timed: false },
  LTC_SOCIAL_WORKER: {
    label: "방문요양 사회복지사 급여관리",
    professions: ["SOCIAL_WORKER"],
    timed: true,
  },
  CHRONIC_CARE: {
    label: "일차의료 만성질환관리",
    professions: ["DOCTOR", "NURSE"],
    timed: false,
  },
  DISABILITY_DOCTOR: {
    label: "장애인 건강주치의",
    professions: ["DOCTOR", "NURSE"],
    timed: false,
  },
};

/** 판정에 쓰는 다른 기관 서비스 일정. 요일이 비면 기간 안의 모든 날, 기간이 비면 끝이 없다. */
export interface ExternalServiceSchedule {
  kind: ExternalServiceKind;
  /** 제공 기관 이름 */
  provider: string | null;
  /** 0=일요일 … 6=토요일 */
  weekdays: number[];
  startsOn: string | null;
  endsOn: string | null;
  /** 이용 시간(HH:mm). 주야간보호·방문목욕·사회복지사 급여관리처럼 시간이 겹칠 때만 해당하는 서비스에 적는다 */
  startTime: string | null;
  endTime: string | null;
}

export interface ExternalService extends ExternalServiceSchedule {
  id: string;
  note: string | null;
}

const optionalDate = blankToNull(z.iso.date("날짜 형식이 올바르지 않습니다"));
const optionalTime = blankToNull(
  z.string().regex(HHMM_REGEX, "시각은 HH:mm 형식으로 입력해 주세요"),
);

export const ExternalServiceSchema = z
  .object({
    kind: z.enum(EXTERNAL_SERVICE_KINDS, "서비스 종류를 골라 주세요"),
    provider: optionalText(100, "기관 이름"),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .default([])
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    startsOn: optionalDate,
    endsOn: optionalDate,
    startTime: optionalTime,
    endTime: optionalTime,
    note: optionalText(200, "메모"),
  })
  .superRefine((value, context) => {
    if (value.startsOn && value.endsOn && value.startsOn > value.endsOn) {
      context.addIssue({
        code: "custom",
        message: "끝나는 날이 시작하는 날보다 앞설 수 없습니다",
        path: ["endsOn"],
      });
    }
    if (!value.startTime !== !value.endTime) {
      context.addIssue({
        code: "custom",
        message: "이용 시간은 시작·끝을 함께 적어 주세요",
        path: ["endTime"],
      });
    } else if (
      value.startTime &&
      value.endTime &&
      value.startTime >= value.endTime
    ) {
      context.addIssue({
        code: "custom",
        message: "끝 시각이 시작 시각보다 뒤여야 합니다",
        path: ["endTime"],
      });
    }
  });
export type ExternalServiceInput = z.input<typeof ExternalServiceSchema>;

/** 그 서비스를 그날 이용하는지(기간·요일). */
export function externalServiceOn(
  service: ExternalServiceSchedule,
  date: string,
): boolean {
  if (service.startsOn && date < service.startsOn) return false;
  if (service.endsOn && date > service.endsOn) return false;
  return (
    service.weekdays.length === 0 ||
    service.weekdays.includes(weekdayIndex(date))
  );
}

/**
 * 재택의료 방문 한 건(겹침을 볼 때). 시각은 기록한 시작·종료, 없으면 방문 일시. timeUnknown이면
 * 날짜만 안다(등록 창에서 시각을 아직 안 정함, 지난 달 건수).
 */
export interface HomeCareVisitTime {
  profession: Profession;
  scheduledAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  timeUnknown?: boolean;
}

/** 방문과 겹치는 다른 기관 서비스 한 건. certain이 아니면 이용 시간을 몰라 겹칠 수도 있다. */
export interface ExternalConflict {
  service: ExternalServiceSchedule;
  certain: boolean;
}

/**
 * 이 방문과 겹치는 다른 기관 서비스. certain이면 산정하지 않는 방문이고, 아니면 겹칠 수도 있는
 * 방문이다(시간이 겹칠 때만 해당하는 서비스인데 이용 시간이나 방문 시각을 모를 때).
 */
export function externalConflicts(
  visit: HomeCareVisitTime,
  services: readonly ExternalServiceSchedule[],
): ExternalConflict[] {
  const date = formatKstDate(new Date(visit.scheduledAt));
  const start = formatKstTime(new Date(visit.startedAt ?? visit.scheduledAt));
  const end = visit.endedAt ? formatKstTime(new Date(visit.endedAt)) : start;
  const conflicts: ExternalConflict[] = [];
  for (const service of services) {
    const info = EXTERNAL_SERVICE_INFO[service.kind];
    if (
      !info.professions.includes(visit.profession) ||
      !externalServiceOn(service, date)
    ) {
      continue;
    }
    if (!info.timed) conflicts.push({ service, certain: true });
    else if (visit.timeUnknown || !service.startTime || !service.endTime) {
      conflicts.push({ service, certain: false });
    } else if (
      // 방문 시각 하나(아직 기록 전)면 이용 시간 안에 드는지, 기록했으면 두 구간이 겹치는지
      start === end
        ? service.startTime <= start && start < service.endTime
        : start < service.endTime && end > service.startTime
    ) {
      conflicts.push({ service, certain: true });
    }
  }
  return conflicts;
}

/** "주야간보호(○○센터, 09:00~17:00)" */
export function externalServiceLabel(service: ExternalServiceSchedule): string {
  const detail = [
    service.provider,
    service.startTime &&
      service.endTime &&
      `${service.startTime}~${service.endTime}`,
  ].filter(Boolean);
  const label = EXTERNAL_SERVICE_INFO[service.kind].label;
  return detail.length > 0 ? `${label}(${detail.join(", ")})` : label;
}

/** 겹침 한 건의 안내(주어 없이): 산정하지 않는 까닭, 또는 이용 시간을 몰라 겹칠 수 있음. */
export function externalConflictText({
  service,
  certain,
}: ExternalConflict): string {
  const label = externalServiceLabel(service);
  if (!certain) {
    return `같은 날 ${label} 이용이 있어 이용 시간에 방문하면 재택의료 급여를 산정하지 않습니다`;
  }
  return EXTERNAL_SERVICE_INFO[service.kind].timed
    ? `${label} 이용 시간이라 재택의료 급여를 산정하지 않습니다`
    : `같은 날 ${withParticle(label, "이/가")} 있어 재택의료 급여를 산정하지 않습니다`;
}

/** 같은 기관의 장기요양 방문간호가 있는 날(재택의료 판정에서 하루짜리 다른 기관 서비스로 본다). */
export function ownLtcNursingDay(date: string): ExternalServiceSchedule {
  return {
    kind: "LTC_NURSING",
    provider: "우리 기관",
    weekdays: [],
    startsOn: date,
    endsOn: date,
    startTime: null,
    endTime: null,
  };
}

/** "화·금" (요일이 비면 "매일") */
export function formatWeekdays(weekdays: readonly number[]): string {
  return weekdays.length === 0
    ? "매일"
    : weekdays.map((day) => WEEKDAY_LABELS[day]).join("·");
}

/* ---------- 사례 정보 묶음 ---------- */

/** 판정에 쓰는 사례 정보. 포괄평가가 비면 기록하지 않은 수급자로 본다(달 전체를 세고 막지 않는다). */
export interface HomeCareCaseFacts {
  /** 평가한 날 순서 */
  assessments: readonly HomeCareAssessmentFact[];
  /** 재택의료 종결 날짜·사유(함께 적거나 함께 비운다) */
  homeCareEndedOn: string | null;
  homeCareEndReason: HomeCareEndReason | null;
  externalServices: readonly ExternalServiceSchedule[];
}

/** 재택의료센터 수급자의 사례 정보(GET /recipients/:id/home-care-case). */
export interface HomeCareCase extends HomeCareCaseFacts {
  assessments: HomeCareAssessment[];
  externalServices: ExternalService[];
}

/* ---------- 그달 산정 기간 ---------- */

/** 산정하지 않는 달: 최초 포괄평가 전, 재평가 기한이 지나고 아직 재평가하지 않음. */
export type HomeCareBlock = "BEFORE_ASSESSMENT" | "LAPSED";

export interface HomeCareMonthPeriod {
  /** 기본료 요건을 세는 기간(한국 날짜, 둘 다 포함) */
  from: string;
  to: string;
  block: HomeCareBlock | null;
  /** 이달 판정의 근거가 되는 마지막 포괄평가와 그다음 재평가 기간. 막힘도 없이 null이면 포괄평가 미기록 */
  assessment:
    (HomeCareAssessmentFact & ReturnType<typeof reassessmentWindow>) | null;
  /** 이달 안에 재택의료를 종결했으면 그 날짜와 사유 */
  ended: { on: string; reason: HomeCareEndReason } | null;
}

/**
 * 그달 기본료 요건을 세는 기간. 1일~말일이 기본이고, 달 중간에 최초 포괄평가를 했으면 평가일부터
 * (지침 Q2-2), 재평가 기한이 지난 뒤 다시 평가한 달도 평가일부터 센다. 종결한 달은 종결일까지.
 * 포괄평가를 하나도 기록하지 않았으면 달 전체를 세고 막지 않는다.
 */
export function homeCareMonthPeriod(
  facts: HomeCareCaseFacts,
  month: string,
): HomeCareMonthPeriod {
  const monthStart = `${month}-01`;
  const monthEnd = monthLastDay(month);
  const { homeCareEndedOn: endedOn, homeCareEndReason: endReason } = facts;
  const ended =
    endedOn && endReason && monthOf(endedOn) === month
      ? { on: endedOn, reason: endReason }
      : null;
  const assessments = [...facts.assessments].sort((a, b) =>
    a.assessedOn.localeCompare(b.assessedOn),
  );
  const index = assessments.findLastIndex(
    (item) => item.assessedOn <= monthEnd,
  );
  const last = assessments[index];
  let from = monthStart;
  let block: HomeCareBlock | null = null;
  let assessment: HomeCareMonthPeriod["assessment"] = null;
  if (last) {
    assessment = { ...last, ...reassessmentWindow(last.assessedOn) };
    const previous = assessments[index - 1];
    if (last.assessedOn >= monthStart) {
      // 이달에 평가: 최초 평가이거나 기한이 지난 뒤의 재평가면 평가일부터 센다.
      const afterLapse =
        previous &&
        reassessmentWindow(previous.assessedOn).deadline < last.assessedOn;
      if (last.kind === "INITIAL" || afterLapse) from = last.assessedOn;
    } else if (assessment.deadline < monthStart) {
      block = "LAPSED";
    }
  } else if (assessments.length > 0) {
    block = "BEFORE_ASSESSMENT";
  }
  return { from, to: ended ? ended.on : monthEnd, block, assessment, ended };
}

/** 판정에서 방문 한 건을 어떻게 세는지. */
export type HomeCareVisitCheck =
  | { counted: true; cautions: ExternalConflict[] }
  | { counted: false; reason: "BEFORE_PERIOD" | "AFTER_END" }
  | { counted: false; reason: "EXTERNAL"; conflict: ExternalConflict };

/**
 * 방문 한 건을 기본료 횟수에 넣는지: 산정 기간 밖이거나 같은 날(같은 시간) 다른 기관 서비스가 있어
 * 산정하지 않으면 빼고, 이용 시간을 몰라 겹칠 수도 있으면 넣되 알린다(cautions). 이달 판정과
 * 직전 연속 개월이 함께 쓴다.
 */
export function checkHomeCareVisit(
  period: HomeCareMonthPeriod,
  services: readonly ExternalServiceSchedule[],
  visit: HomeCareVisitTime,
  date: string,
): HomeCareVisitCheck {
  if (date < period.from) return { counted: false, reason: "BEFORE_PERIOD" };
  if (date > period.to) return { counted: false, reason: "AFTER_END" };
  const conflicts = externalConflicts(visit, services);
  const certain = conflicts.find((conflict) => conflict.certain);
  return certain
    ? { counted: false, reason: "EXTERNAL", conflict: certain }
    : { counted: true, cautions: conflicts };
}
