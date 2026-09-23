import type { FieldOption, NumberFieldDef, NumberPair } from "./engine.js";

/** 서식 여러 곳에 같은 모양으로 나오는 선택지. */

export const YES_NO_OPTIONS: readonly FieldOption[] = [
  { value: "YES", label: "유" },
  { value: "NO", label: "무" },
];

export const OTHER_OPTION: FieldOption = {
  value: "OTHER",
  label: "기타",
  detail: { kind: "text", label: "내용" },
};

/** 재택의료센터 방문점검 기록지(의사·간호사) 향후계획 */
export const HOME_CARE_PLAN_OPTIONS: readonly FieldOption[] = [
  { value: "CONTINUE", label: "관리지속" },
  { value: "REASSESS", label: "재평가" },
  { value: "CASE_MEETING", label: "팀 사례회의" },
  { value: "PLAN_CHANGE", label: "계획 변경" },
  { value: "CLOSE", label: "종결" },
  OTHER_OPTION,
];

/** 재택의료센터 간호 항목(의사 서식의 간호지시, 간호사 서식의 방문내용) */
export const HOME_CARE_NURSING_ITEMS = [
  { value: "BASIC_HEALTH", label: "기초건강관리" },
  { value: "MEDICATION", label: "투약관리" },
  { value: "EXERCISE", label: "운동관리" },
  { value: "NUTRITION", label: "영양관리" },
  { value: "PSYCH", label: "정신심리상담" },
  { value: "PAIN", label: "통증관리" },
  {
    value: "TUBE",
    label: "튜브관리",
    hint: "비위관·유치도뇨관 등 튜브 교체·관리",
  },
  { value: "PRESSURE_ULCER", label: "욕창관리" },
] as const satisfies readonly FieldOption[];

/* ---------- 활력징후(장기요양 방문간호·재택의료 간호사 서식) ---------- */

const BLOOD_PRESSURE_QUESTION = "혈압은 얼마였나요?";

export const SYSTOLIC_FIELD = {
  key: "systolic",
  label: "수축기 혈압",
  type: "number",
  unit: "mmHg",
  min: 40,
  max: 300,
  decimals: 0,
  dictation: true,
  question: BLOOD_PRESSURE_QUESTION,
} as const satisfies NumberFieldDef;

export const DIASTOLIC_FIELD = {
  key: "diastolic",
  label: "이완기 혈압",
  type: "number",
  unit: "mmHg",
  min: 20,
  max: 200,
  decimals: 0,
  dictation: true,
  question: BLOOD_PRESSURE_QUESTION,
} as const satisfies NumberFieldDef;

/** 혈압은 "수축기 / 이완기" 한 줄로 적고, 수축기가 더 높아야 한다. */
export const BLOOD_PRESSURE_PAIR: NumberPair = {
  label: "혈압",
  keys: [SYSTOLIC_FIELD.key, DIASTOLIC_FIELD.key],
  firstGreater: true,
};

export const PULSE_FIELD = {
  key: "pulse",
  label: "맥박",
  type: "number",
  unit: "회/분",
  min: 20,
  max: 250,
  decimals: 0,
  dictation: true,
  question: "맥박은 1분에 몇 회였나요?",
} as const satisfies NumberFieldDef;

export const TEMPERATURE_FIELD = {
  key: "temperature",
  label: "체온",
  type: "number",
  unit: "℃",
  min: 30,
  max: 45,
  decimals: 1,
  dictation: true,
  question: "체온은 몇 도였나요?",
} as const satisfies NumberFieldDef;

export const GLUCOSE_FIELD = {
  key: "glucose",
  label: "혈당",
  type: "number",
  unit: "mg/dL",
  min: 10,
  max: 1000,
  decimals: 0,
  dictation: true,
} as const satisfies NumberFieldDef;
