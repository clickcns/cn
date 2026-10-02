import { z } from "zod";
import type { InstitutionType } from "./organization.js";
import { isoMonthSchema, optionalText } from "./schema.js";

/*
 * 재택의료 수입이 쓰는 수가·비율·한도. 지침이 바뀌면 운영자가 관리 웹 [수가 관리]에서 시행 월과 함께
 * 새 묶음을 넣고, 그달 판정·금액은 시행 월이 그달 이하인 가장 늦은 묶음을 쓴다. 묶음은 덮어쓰지 않는다:
 * 고치면 그 묶음을 지우고 고친 묶음을 새로 넣으며(replacesId), 지운·고친 묶음도 이력에 남는다. 넣은 묶음이 없는 달은 코드 기본값(DEFAULT_HOME_CARE_FEE_SET)이다.
 * 규칙의 모양(직종별 요건, 재평가 기한, 같은 날 산정 제외 종류)은 여기 두지 않는다 — 바뀌면 계산이
 * 바뀌므로 코드와 테스트를 고친다. 지침 받는 곳·쪽수는 docs/fees.html(/dev/fees).
 */

/** 원·%가 아닌 칸(횟수·사람·개월·분)은 1 이상, max 이하의 정수. */
interface CountFieldDef {
  key: string;
  label: string;
  unit: "회" | "명" | "개월" | "분";
  max: number;
}
interface AmountFieldDef {
  key: string;
  label: string;
  /** 원은 0 이상 정수, %는 0~100(50이면 절반) */
  unit: "원" | "%";
}

/**
 * 화면의 묶음과 칸(이 순서로 보인다). 이 목록 하나에서 검사 스키마(HomeCareFeesSchema)와
 * HomeCareFees 모양이 나온다 — 칸을 더하면 DEFAULT_HOME_CARE_FEE_SET에도 값을 넣는다.
 */
export const HOME_CARE_FEE_GROUPS = [
  {
    group: "재택의료센터",
    fields: [
      { key: "baseFee", label: "재택의료기본료(월)", unit: "원" },
      { key: "deathFeePercent", label: "사망 종결 기본료 비율", unit: "%" },
      { key: "continuityFee", label: "지속관리료", unit: "원" },
      {
        key: "continuityMonths",
        label: "지속관리료 연속 개월",
        unit: "개월",
        max: 24,
      },
      { key: "extraNursingFee", label: "추가간호료(방문당)", unit: "원" },
      {
        key: "extraNursingMax",
        label: "추가간호 월 최대",
        unit: "회",
        max: 31,
      },
      {
        key: "extraNursingMinMinutes",
        label: "추가간호 최소 시간",
        unit: "분",
        max: 240,
      },
      {
        key: "doctorRecipientLimit",
        label: "의사 1인당 기본료 수급자(월)",
        unit: "명",
        max: 10_000,
      },
    ],
  },
  {
    group: "방문진료료",
    fields: [
      { key: "visitFeeClinic", label: "방문진료료Ⅰ 의원·보건기관", unit: "원" },
      { key: "visitFeeHospital", label: "방문진료료Ⅰ 병원급 이상", unit: "원" },
      { key: "sameBuildingPercent", label: "동일 건물 비율", unit: "%" },
      {
        key: "sameHouseholdPercent",
        label: "동일 세대 비율(두 번째부터)",
        unit: "%",
      },
      {
        key: "doctorVisitFeeLimit",
        label: "의사 1인당 방문진료료(월)",
        unit: "회",
        max: 10_000,
      },
    ],
  },
] as const satisfies readonly {
  group: string;
  fields: readonly (AmountFieldDef | CountFieldDef)[];
}[];

export type HomeCareFeeField =
  (typeof HOME_CARE_FEE_GROUPS)[number]["fields"][number];
export type HomeCareFeeKey = HomeCareFeeField["key"];
export type HomeCareFees = Record<HomeCareFeeKey, number>;

export const HOME_CARE_FEE_FIELDS: readonly HomeCareFeeField[] =
  HOME_CARE_FEE_GROUPS.flatMap(
    (group): readonly HomeCareFeeField[] => group.fields,
  );

function feeFieldSchema(field: HomeCareFeeField) {
  const { label } = field;
  const value = z.number(`${label}을(를) 입력해 주세요`);
  switch (field.unit) {
    case "원":
      return value
        .int(`${label}은(는) 원 단위 정수로 입력해 주세요`)
        .min(0, `${label}은(는) 0원 이상이어야 합니다`)
        .max(10_000_000, `${label}이(가) 너무 큽니다`);
    case "%":
      return value
        .min(0, `${label}은(는) 0% 이상이어야 합니다`)
        .max(100, `${label}은(는) 100% 이하여야 합니다`);
    default:
      return value
        .int(`${label}은(는) 정수로 입력해 주세요`)
        .min(1, `${label}은(는) 1 이상이어야 합니다`)
        .max(field.max, `${label}이(가) 너무 큽니다`);
  }
}

export const HomeCareFeesSchema = z.object(
  Object.fromEntries(
    HOME_CARE_FEE_FIELDS.map((field) => [field.key, feeFieldSchema(field)]),
  ) as Record<HomeCareFeeKey, z.ZodNumber>,
);

/** 수가 묶음과 근거(지침 판·쪽). */
export interface HomeCareFeeSet {
  fees: HomeCareFees;
  source: string;
}

/**
 * 코드 기본값: 재택의료센터 지침 2026.2판(’26.2.1 기준) 19쪽 급여 목록과 13~14쪽, 일차의료 방문진료
 * 지침 2026.4판 12쪽 급여 목록·10~11쪽. 관리 웹에서 넣은 수가가 없는 달에 쓴다 — 고치면 넣은 묶음이
 * 없는 지난달 금액까지 바뀌므로, 지침이 바뀌면 고치지 말고 [수가 관리]에서 새 묶음을 넣는다.
 */
export const DEFAULT_HOME_CARE_FEE_SET: HomeCareFeeSet = {
  fees: {
    baseFee: 140_000,
    deathFeePercent: 50,
    continuityFee: 60_000,
    continuityMonths: 6,
    extraNursingFee: 53_770,
    extraNursingMax: 3,
    extraNursingMinMinutes: 30,
    doctorRecipientLimit: 140,
    visitFeeClinic: 131_720,
    visitFeeHospital: 140_600,
    sameBuildingPercent: 75,
    sameHouseholdPercent: 50,
    doctorVisitFeeLimit: 140,
  },
  source:
    "코드 기본값 — 재택의료센터 지침 2026.2판(’26.2.1 기준) 19쪽, 일차의료 방문진료 지침 2026.4판 12쪽",
};

/** 기관 종별의 방문진료료Ⅰ 단가. */
export function visitFeeFor(
  fees: HomeCareFees,
  institutionType: InstitutionType,
): number {
  return institutionType === "HOSPITAL"
    ? fees.visitFeeHospital
    : fees.visitFeeClinic;
}

/**
 * 저장한 수가 묶음 읽기: 그 뒤에 더한 칸은 코드 기본값으로 채운다(지난 묶음이 새 칸을 몰라도 계산이
 * 깨지지 않게 — 기본값이 지난달에 맞지 않는 칸이면 칸을 더하는 마이그레이션에서 지난 묶음에 값을
 * 넣는다). 형식이 틀리면 null.
 */
export function parseStoredFees(value: unknown): HomeCareFees | null {
  const parsed = HomeCareFeesSchema.safeParse(
    value && typeof value === "object"
      ? { ...DEFAULT_HOME_CARE_FEE_SET.fees, ...value }
      : null,
  );
  return parsed.success ? parsed.data : null;
}

/** 운영자가 넣은 수가 묶음 하나. 지우거나 고치면 deletedAt이 붙고 이력에 남는다. */
export interface HomeCareFeeSchedule {
  id: string;
  /** 이 묶음이 고친 묶음(그 묶음은 deletedAt이 붙어 "고침"으로 보인다) */
  replacesId: string | null;
  /** 시행 월(YYYY-MM). 그달부터 다음 묶음의 시행 월 전까지 쓴다 */
  effectiveMonth: string;
  fees: HomeCareFees;
  /** 근거(지침 판·쪽) */
  source: string;
  note: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  deletedBy: { id: string; name: string } | null;
  deletedAt: string | null;
}

/** GET /home-care-fee-schedules: 코드 기본값과 넣은 묶음(시행 월 늦은 순, 지운 것 포함). */
export interface HomeCareFeeScheduleList {
  defaults: HomeCareFeeSet;
  schedules: HomeCareFeeSchedule[];
}

export const CreateHomeCareFeeScheduleSchema = z.object({
  effectiveMonth: isoMonthSchema,
  fees: HomeCareFeesSchema,
  source: z
    .string("근거를 적어 주세요")
    .trim()
    .min(1, "근거(지침 판·쪽)를 적어 주세요")
    .max(200, "근거는 200자 이하로 적어 주세요"),
  note: optionalText(500, "메모"),
});
export type CreateHomeCareFeeScheduleInput = z.input<
  typeof CreateHomeCareFeeScheduleSchema
>;

/** PUT /home-care-fee-schedules/:id — 고친 묶음 전체(시행 월도 고칠 수 있다). */
export const UpdateHomeCareFeeScheduleSchema = CreateHomeCareFeeScheduleSchema;
export type UpdateHomeCareFeeScheduleInput = CreateHomeCareFeeScheduleInput;

/**
 * 그달에 쓰는 수가 묶음: 지우지 않은 것 중 시행 월이 그달 이하인 가장 늦은 묶음, 없으면 null(코드
 * 기본값을 쓴다). schedules 순서는 상관없다. 서버(DB 행)와 화면(API 응답)이 함께 쓴다.
 */
export function scheduleForMonth<
  T extends { effectiveMonth: string; deletedAt: string | Date | null },
>(schedules: readonly T[], month: string): T | null {
  let found: T | null = null;
  for (const schedule of schedules) {
    if (
      !schedule.deletedAt &&
      schedule.effectiveMonth <= month &&
      (!found || schedule.effectiveMonth > found.effectiveMonth)
    ) {
      found = schedule;
    }
  }
  return found;
}
