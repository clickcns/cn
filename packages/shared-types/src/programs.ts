import { FORMS, type FormId } from "./forms/index.js";
import { PROFESSION_LABELS, type Profession } from "./roles.js";
import { withParticle } from "./text.js";

/**
 * 사업(서비스) 구분. 사업과 담당자 직종이 방문 때 쓸 서식을 정한다.
 * 기관은 여러 사업을 할 수 있다(예: 재택의료센터이면서 일차의료 방문진료 시범기관).
 */
export const PROGRAMS = [
  "PRIMARY_CARE",
  "HOME_CARE_CENTER",
  "LTC_NURSING",
] as const;
export type Program = (typeof PROGRAMS)[number];

export const PROGRAM_LABELS: Record<Program, string> = {
  PRIMARY_CARE: "일차의료 방문진료",
  HOME_CARE_CENTER: "재택의료센터",
  LTC_NURSING: "장기요양 방문간호",
};

/** 표·배지처럼 좁은 곳에 쓰는 사업 이름. */
export const PROGRAM_SHORT_LABELS: Record<Program, string> = {
  PRIMARY_CARE: "방문진료",
  HOME_CARE_CENTER: "재택의료",
  LTC_NURSING: "방문간호",
};

/** 장기요양 수급자(등급이 있는 사람)만 등록할 수 있는 사업. 일차의료 방문진료는 등급이 없어도 된다. */
export function requiresCareGrade(program: Program): boolean {
  return program !== "PRIMARY_CARE";
}

/**
 * 사업·직종별 서식 한 장의 규칙.
 * - 필수 서식은 항상 쓰고 뺄 수 없다.
 * - 선택 서식은 방문을 만들 때 고르고(defaultOn이면 미리 켜 둔다), 확정 전까지 기록 화면에서 켜고 끈다.
 */
export interface FormRule {
  formId: FormId;
  required: boolean;
  /** 선택 서식을 방문을 만들 때 미리 켜 둘지 */
  defaultOn?: boolean;
  /** 선택 서식을 쓰는 때(화면 안내) */
  when?: string;
}

/**
 * 사업·직종별 서식 규칙(나열 순서가 화면의 탭 순서다). 없는 조합은 그 직종이 이 사업의 방문을 맡을 수 없다는 뜻이다.
 * 재택의료센터 의사의 방문진료료는 일차의료 방문진료 기준으로 청구하므로 청구할 때만 별지 제4호(심평원)를 쓴다.
 * 의사 1인당 월 한도를 넘었거나 청구하지 않는 방문은 제6호(공단)만 쓴다. 협력 기관 확인 전이라 기본으로 켜 둔다.
 */
export const PROGRAM_FORMS: Record<
  Program,
  Partial<Record<Profession, readonly FormRule[]>>
> = {
  PRIMARY_CARE: { DOCTOR: [{ formId: "PRIMARY_CARE_CHECK", required: true }] },
  HOME_CARE_CENTER: {
    DOCTOR: [
      {
        formId: "PRIMARY_CARE_CHECK",
        required: false,
        defaultOn: true,
        when: "방문진료료를 청구할 때",
      },
      { formId: "HOME_CARE_DOCTOR", required: true },
    ],
    NURSE: [{ formId: "HOME_CARE_NURSE", required: true }],
    SOCIAL_WORKER: [{ formId: "HOME_CARE_SOCIAL", required: true }],
  },
  LTC_NURSING: { NURSE: [{ formId: "LTC_NURSING", required: true }] },
};

export function formRulesFor(
  program: Program,
  profession: Profession | null,
): readonly FormRule[] {
  return profession ? (PROGRAM_FORMS[program][profession] ?? []) : [];
}

/**
 * 화면에서 켜고 끈 선택 서식(서식 ID → 켬). 없는 서식은 규칙의 defaultOn을 따른다.
 * 서식 ID로만 기억하므로 사업·담당자를 바꿔도 그대로 쓸 수 있다(필수 서식에는 영향이 없다).
 */
export type FormChoices = Partial<Record<FormId, boolean>>;

/**
 * 규칙 순서의 서식 목록: 필수 서식 + 켠 선택 서식. choices가 없으면 기본값
 * (필수 + 미리 켜 둔 선택 서식)이다. 두 웹의 서식 고르기와 서버의 기본값이 쓴다.
 */
export function resolveFormIds(
  program: Program,
  profession: Profession | null,
  choices: FormChoices = {},
): FormId[] {
  return formRulesFor(program, profession)
    .filter((rule) => rule.required || (choices[rule.formId] ?? rule.defaultOn))
    .map((rule) => rule.formId);
}

/** 이 직종이 이 사업의 방문을 맡을 수 있는지(쓸 서식이 있는지). */
export function canHandleProgram(
  program: Program,
  profession: Profession | null,
): boolean {
  return formRulesFor(program, profession).length > 0;
}

/** 켜고 끌 수 있는 선택 서식이 있는지. */
export function hasOptionalForms(
  program: Program,
  profession: Profession | null,
): boolean {
  return formRulesFor(program, profession).some((rule) => !rule.required);
}

export type FormSelectionResult =
  { ok: true; formIds: FormId[] } | { ok: false; message: string };

/**
 * 요청으로 온 서식 목록을 규칙으로 확인하고 규칙 순서로 정리한다(서버: 방문 만들기·서식 바꾸기).
 * selected가 없으면 기본값을 쓴다. 필수 서식이 빠졌거나 그 사업·직종이 쓰지 않는 서식이 섞이면 실패다.
 */
export function selectForms(
  program: Program,
  profession: Profession | null,
  selected?: readonly FormId[] | null,
): FormSelectionResult {
  const rules = formRulesFor(program, profession);
  if (rules.length === 0) {
    const who = profession ? PROFESSION_LABELS[profession] : "이 사용자";
    return {
      ok: false,
      message: `${withParticle(who, "은/는")} ${PROGRAM_LABELS[program]} 방문을 맡을 수 없습니다`,
    };
  }
  if (selected == null) {
    return { ok: true, formIds: resolveFormIds(program, profession) };
  }
  const outside = selected.find(
    (formId) => !rules.some((rule) => rule.formId === formId),
  );
  if (outside) {
    return {
      ok: false,
      message: `${withParticle(FORMS[outside].shortTitle, "은/는")} 이 방문에서 쓰지 않는 서식입니다`,
    };
  }
  const missing = rules.find(
    (rule) => rule.required && !selected.includes(rule.formId),
  );
  if (missing) {
    return {
      ok: false,
      message: `${withParticle(FORMS[missing.formId].shortTitle, "은/는")} 필수 서식이라 뺄 수 없습니다`,
    };
  }
  return {
    ok: true,
    formIds: rules
      .filter((rule) => selected.includes(rule.formId))
      .map((rule) => rule.formId),
  };
}
