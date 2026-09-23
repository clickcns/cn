import {
  HOME_CARE_NURSING_ITEMS,
  HOME_CARE_PLAN_OPTIONS,
  OTHER_OPTION,
} from "./common.js";
import type { FieldOption, FormDef } from "./engine.js";

const TREND_OPTIONS: readonly FieldOption[] = [
  { value: "MAINTAINED", label: "유지" },
  { value: "IMPROVED", label: "호전" },
  { value: "WORSENED", label: "악화" },
];

/**
 * 장기요양 재택의료센터 방문점검 기록지(의사) — 재택의료센터 시범사업 지침 별지 제6호.
 * 공단 요양기관정보마당(재택의료센터 시범사업 전산)에 등록하고, 원본은 기관이 5년 보관한다.
 * 같은 방문의 방문진료료는 일차의료 방문진료 점검서식(별지 제4호)으로 따로 제출한다.
 */
export const HOME_CARE_DOCTOR_FORM = {
  id: "HOME_CARE_DOCTOR",
  code: "별지 제6호",
  title: "장기요양 재택의료센터 방문점검 기록지(의사)",
  shortTitle: "방문점검 기록지(의사)",
  submitTo: "공단 요양기관정보마당(재택의료센터 시범사업)",
  guide: [
    "방문 사유(정기·수시·응급)와 동행자",
    "신체·인지 기능: 지난번과 비교(유지·호전·악화)와 현재 수준",
    "진찰·상담 내용, 침습적 처치, 처방·검사·전원",
    "간호사에게 지시한 내용",
    "향후 계획과 총평",
  ],
  sttTerms: ["진찰", "간호지시", "전원", "낙상", "약물 부작용"],
  sections: [
    {
      title: "기본사항",
      fields: [
        {
          key: "companion",
          label: "동행자",
          type: "multi",
          dictation: true,
          carryOver: true,
          options: [
            { value: "NURSE", label: "간호사" },
            { value: "SOCIAL_WORKER", label: "사회복지사" },
            { value: "OTHER", label: "기타" },
          ],
        },
        {
          key: "visitReason",
          label: "방문사유",
          type: "single",
          dictation: true,
          question: "정기 방문이었나요, 수시·응급 방문이었나요?",
          options: [
            { value: "REGULAR", label: "정기" },
            { value: "ADHOC", label: "수시" },
            { value: "EMERGENCY", label: "응급" },
            OTHER_OPTION,
          ],
        },
      ],
    },
    {
      title: "건강상태 점검",
      fields: [
        {
          key: "physicalTrend",
          label: "신체기능 자립성(변화)",
          type: "single",
          dictation: true,
          question: "신체기능은 지난번과 비교해 어떤가요?",
          options: TREND_OPTIONS,
        },
        {
          key: "physicalLevel",
          label: "신체기능 자립성(수준)",
          type: "single",
          dictation: true,
          carryOver: true,
          options: [
            { value: "INDEPENDENT", label: "정상독립" },
            { value: "INDOOR_INDEPENDENT", label: "실내독립" },
            { value: "INDOOR_SOME_HELP", label: "실내 일부 도움" },
            { value: "INDOOR_MUCH_HELP", label: "실내 많은 도움" },
            { value: "INDOOR_FULL_HELP", label: "실내 완전 도움" },
          ],
        },
        {
          key: "cognitiveTrend",
          label: "인지기능 자립성(변화)",
          type: "single",
          dictation: true,
          question: "인지기능은 지난번과 비교해 어떤가요?",
          options: TREND_OPTIONS,
        },
        {
          key: "cognitiveLevel",
          label: "인지기능 자립성(수준)",
          type: "single",
          dictation: true,
          carryOver: true,
          options: [
            { value: "INDEPENDENT", label: "정상독립" },
            { value: "WEEKLY_1_2", label: "주 1~2회 관찰요" },
            { value: "WEEKLY_3_4", label: "주 3~4회 관찰요" },
            { value: "DAILY", label: "매일 관찰요" },
            { value: "SEVERE", label: "심한장애" },
          ],
        },
      ],
    },
    {
      title: "방문내용",
      fields: [
        {
          key: "consultation",
          label: "진찰 및 상담",
          type: "multi",
          dictation: true,
          question: "진찰·상담한 내용을 말씀해 주세요",
          options: [
            { value: "DISEASE", label: "질병관리" },
            { value: "EXERCISE", label: "운동" },
            { value: "FALL", label: "낙상관리" },
            { value: "INFECTION", label: "감염관리" },
            { value: "IV_FLUID", label: "수액주입" },
            { value: "NUTRITION", label: "영양관리" },
            { value: "PAIN", label: "통증관리" },
            { value: "DRUG_SIDE_EFFECT", label: "약물 부작용" },
            { value: "CHECKUP", label: "정기검진 및 예방접종" },
            { value: "PRESSURE_ULCER", label: "욕창관리" },
            { value: "EMERGENCY", label: "응급상황" },
            OTHER_OPTION,
          ],
        },
        {
          key: "invasive",
          label: "침습적 처치",
          type: "text",
          maxLength: 200,
          multiline: false,
          dictation: true,
          hint: "시행한 침습적 처치 내용(예: 유치도뇨관 교체, 욕창 괴사조직 제거). 없으면 빈 칸",
        },
        {
          key: "otherActions",
          label: "그 외",
          type: "multi",
          dictation: true,
          options: [
            { value: "PRESCRIPTION", label: "처방전 발생" },
            {
              value: "TEST",
              label: "검사 시행",
              detail: { kind: "text", label: "검사명" },
            },
            { value: "TRANSFER", label: "의료기관 전원" },
            OTHER_OPTION,
          ],
        },
        {
          key: "nursingOrders",
          label: "간호지시",
          type: "multi",
          dictation: true,
          hint: "의사가 간호사에게 지시한 관리 항목",
          options: HOME_CARE_NURSING_ITEMS,
        },
        {
          key: "notes",
          label: "기타사항",
          type: "text",
          maxLength: 500,
          multiline: true,
          dictation: true,
        },
      ],
    },
    {
      title: "향후 계획",
      fields: [
        {
          key: "plan",
          label: "향후계획",
          type: "single",
          dictation: true,
          question: "향후 계획은 어떻게 되나요?",
          options: HOME_CARE_PLAN_OPTIONS,
        },
        {
          key: "summary",
          label: "총평",
          type: "text",
          maxLength: 1000,
          multiline: true,
          dictation: true,
          question: "수급자 상태를 한두 문장으로 정리해 주세요(총평)",
          hint: "수급자 상태와 판단을 간결한 기록체로",
        },
      ],
    },
  ],
} as const satisfies FormDef;
