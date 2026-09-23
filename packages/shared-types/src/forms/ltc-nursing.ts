import {
  BLOOD_PRESSURE_PAIR,
  DIASTOLIC_FIELD,
  GLUCOSE_FIELD,
  PULSE_FIELD,
  SYSTOLIC_FIELD,
  TEMPERATURE_FIELD,
} from "./common.js";
import type { FormDef, OptionDetail } from "./engine.js";

const MINUTES: OptionDetail = { kind: "minutes", note: true };

/**
 * 장기요양 방문간호 급여제공기록지 — 노인장기요양보험법 시행규칙 별지 제14호.
 * 기록은 공단 스마트장기요양 앱으로 전송한다. 항목별 제공 시간(분)을 적는다.
 * 항목 이름과 구분은 서식 원본과 협력 간호사 확인을 거쳐 확정한다.
 */
export const LTC_NURSING_FORM = {
  id: "LTC_NURSING",
  code: "별지 제14호",
  title: "장기요양급여 제공기록지(방문간호)",
  shortTitle: "방문간호 제공기록지",
  submitTo: "공단 스마트장기요양 앱",
  guide: [
    "전반적인 상태·식사·수면 (보호자 말씀 포함)",
    "혈압·맥박·체온 (필요하면 호흡·혈당)",
    "제공한 처치와 걸린 시간 (예: 욕창 드레싱 15분)",
    "상처·욕창 크기와 변화",
    "복약 상태와 교육한 내용",
    "다음 방문 계획",
  ],
  sttTerms: ["혈압", "맥박", "체온", "욕창", "드레싱", "삼출물", "투약"],
  numberPairs: [BLOOD_PRESSURE_PAIR],
  followUps: [
    {
      anyOf: ["healthCare", "nursingCare"],
      question:
        "오늘 제공한 처치(건강관리·간호관리)와 걸린 시간을 말씀해 주세요",
    },
  ],
  sections: [
    {
      title: "활력징후",
      fields: [
        SYSTOLIC_FIELD,
        DIASTOLIC_FIELD,
        PULSE_FIELD,
        TEMPERATURE_FIELD,
        {
          key: "respiration",
          label: "호흡",
          type: "number",
          unit: "회/분",
          min: 4,
          max: 80,
          decimals: 0,
          dictation: true,
        },
        GLUCOSE_FIELD,
      ],
    },
    {
      title: "건강관리",
      fields: [
        {
          key: "healthCare",
          label: "건강관리",
          type: "multi",
          dictation: true,
          description: "제공한 항목을 고르고 시간(분)을 적어 주세요.",
          hint: "제공했다고 말한 항목만. 활력징후 측정만으로는 넣지 않는다",
          options: [
            {
              value: "JOINT_CONTRACTURE",
              label: "관절구축 예방",
              detail: MINUTES,
              hint: "관절 운동, 스트레칭, 구축 예방 체위",
            },
            {
              value: "MEDICATION",
              label: "투약 관리",
              detail: MINUTES,
              hint: "복약 확인·지도, 약 정리, 복약 교육",
            },
            {
              value: "BASIC_HEALTH",
              label: "기초 건강관리",
              detail: MINUTES,
              hint: "건강 상담, 위생·식사·수면 등 일상 건강관리 지도",
            },
            {
              value: "COGNITIVE_TRAINING",
              label: "인지 훈련",
              detail: MINUTES,
            },
          ],
        },
      ],
    },
    {
      title: "간호관리",
      fields: [
        {
          key: "nursingCare",
          label: "간호관리",
          type: "multi",
          dictation: true,
          description: "제공한 항목을 고르고 시간(분)을 적어 주세요.",
          hint: "제공했다고 말한 항목만",
          options: [
            {
              value: "PRESSURE_ULCER",
              label: "욕창 관리",
              detail: MINUTES,
              hint: "욕창·상처 관찰, 드레싱",
            },
            {
              value: "NUTRITION",
              label: "영양 관리(비위관)",
              detail: MINUTES,
              hint: "비위관 교체·관리, 경관 영양",
            },
            { value: "PAIN", label: "통증 관리", detail: MINUTES },
            {
              value: "EXCRETION",
              label: "배설 관리(도뇨관·장루)",
              detail: MINUTES,
              hint: "유치도뇨관 교체·관리, 장루 관리, 관장",
            },
            { value: "DIABETIC_FOOT", label: "당뇨발 관리", detail: MINUTES },
            {
              value: "RESPIRATORY",
              label: "호흡기 관리(흡인·기관절개·산소)",
              detail: MINUTES,
            },
            { value: "DIALYSIS", label: "투석 관리", detail: MINUTES },
            { value: "ORAL", label: "구강 관리", detail: MINUTES },
          ],
        },
      ],
    },
    {
      title: "특이사항·다음 계획",
      fields: [
        {
          key: "specialNote",
          label: "특이사항",
          type: "text",
          maxLength: 2000,
          multiline: true,
          // 공단 스마트장기요양 앱 특이사항 칸의 글자 수 제한
          softLimit: { length: 200, target: "공단 앱 칸" },
          dictation: true,
          question: "수급자 상태나 특이사항을 말씀해 주세요",
          hint: "상태 변화, 관찰 내용, 보호자 진술('(보호자 진술)'로 표시), 교육 내용. 짧은 기록체",
        },
        {
          key: "nextPlan",
          label: "다음 계획",
          type: "text",
          maxLength: 1000,
          multiline: true,
          dictation: true,
          question: "다음 방문 계획을 말씀해 주세요",
        },
      ],
    },
  ],
} as const satisfies FormDef;
