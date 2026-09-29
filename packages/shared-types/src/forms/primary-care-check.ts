import { OTHER_OPTION, YES_NO_OPTIONS } from "./common.js";
import type { FormDef } from "./engine.js";

/**
 * 일차의료 방문진료 점검서식 — 「일차의료 방문진료 수가 시범사업」 지침 별지 제4호.
 * 의사가 방문진료를 한 뒤 심평원 시범사업 자료제출 시스템에 입력한다(제출해야 방문진료료 산정).
 * 환자 성명·주민등록번호·주소, 의사명·면허번호, 방문일·진료 시각은 수급자·사용자·방문 정보에서 온다.
 */
export const PRIMARY_CARE_CHECK_FORM = {
  id: "PRIMARY_CARE_CHECK",
  code: "별지 제4호",
  title: "일차의료 방문진료 점검서식",
  shortTitle: "방문진료 점검서식",
  submitTo: "심평원 시범사업 자료제출 시스템",
  guide: [
    "방문진료 사유(수술 관련 처치, 급성기 질환, 의료기기 교체, 욕창, 수액 등)",
    "진료·조치 내용(침습적 처치, 검사, 처방전, 응급실 권고, 진찰·상담)",
    "향후 계획과 지역사회 연계 여부",
    "동반 인력(간호사 등)과 예약 여부",
  ],
  sttTerms: ["방문진료", "처방전", "수액", "침습적 처치", "응급실"],
  sections: [
    {
      title: "환자 정보",
      fields: [
        {
          key: "ltcGrade",
          label: "대상자 구분(장기요양 등급)",
          type: "single",
          dictation: false,
          carryOver: true,
          description:
            "장기요양 1·2등급 와상·요양비에 해당하지 않으면 '해당없음'",
          options: [
            { value: "NONE", label: "해당없음" },
            { value: "GRADE_1", label: "1등급" },
            { value: "GRADE_2", label: "2등급" },
          ],
        },
        {
          key: "bedridden",
          label: "와상 여부",
          type: "single",
          dictation: false,
          carryOver: true,
          options: YES_NO_OPTIONS,
        },
        {
          key: "homeCareSupport",
          label: "요양비",
          type: "multi",
          dictation: false,
          carryOver: true,
          options: [
            { value: "OXYGEN", label: "산소치료" },
            { value: "VENTILATOR", label: "인공호흡기" },
          ],
        },
        {
          key: "sameBuilding",
          label: "동일 건물 및 동일 세대 방문 여부",
          type: "single",
          dictation: false,
          description: "동일 세대는 두 번째 환자부터 체크",
          options: [
            { value: "NONE", label: "해당 없음" },
            { value: "SAME_BUILDING", label: "동일 건물" },
            { value: "SAME_HOUSEHOLD", label: "동일 세대" },
          ],
        },
      ],
    },
    {
      title: "대상자 유형",
      fields: [
        {
          key: "copayment",
          label: "방문진료료 본인부담",
          type: "single",
          dictation: false,
          carryOver: true,
          description: "거동 불편 환자는 일부 본인부담",
          options: [
            { value: "PARTIAL", label: "일부 본인부담" },
            { value: "FULL", label: "전액 본인부담" },
          ],
        },
        {
          key: "mobility",
          label: "거동불편 유형",
          type: "multi",
          dictation: false,
          carryOver: true,
          options: [
            { value: "PARALYSIS", label: "마비(하지·사지·편마비 등)" },
            { value: "POST_SURGERY", label: "수술 직후(한 달 이내)" },
            { value: "TERMINAL", label: "말기질환(암, 사망선고 등)" },
            {
              value: "DEVICE",
              label: "의료기기 등 부착(산소치료, 인공호흡기 등)",
            },
            { value: "NEURO_DEGENERATIVE", label: "신경계퇴행성 질환" },
            { value: "PRESSURE_ULCER", label: "욕창 및 궤양" },
            { value: "PSYCHIATRIC", label: "정신과적 질환" },
            { value: "COGNITIVE", label: "인지장애" },
            OTHER_OPTION,
          ],
        },
        {
          key: "frequencyException",
          label: "산정횟수 예외적용",
          type: "multi",
          dictation: false,
          carryOver: true,
          description: "주 3회를 넘겨 방문하는 경우 사유",
          options: [
            { value: "NONE", label: "해당없음" },
            { value: "TERMINAL_CANCER", label: "말기암환자" },
            { value: "MULTIPLE_SCLEROSIS", label: "다발성경화증" },
            { value: "MYASTHENIA_GRAVIS", label: "중증근무력증" },
            { value: "CERVICAL_INJURY", label: "경추손상" },
            { value: "POST_SURGERY", label: "수술직후" },
            OTHER_OPTION,
          ],
        },
      ],
    },
    {
      title: "방문진료 기본정보",
      fields: [
        {
          key: "appointment",
          label: "방문진료유형",
          type: "single",
          required: true,
          dictation: true,
          carryOver: true,
          hint: "미리 잡은 방문이면 예약, 당일 요청·호출이면 비예약",
          options: [
            { value: "SCHEDULED", label: "예약" },
            { value: "UNSCHEDULED", label: "비예약" },
          ],
        },
        {
          key: "companion",
          label: "방문진료 동반인력",
          type: "multi",
          dictation: true,
          carryOver: true,
          options: [
            { value: "NONE", label: "없음" },
            { value: "HOME_CARE_NURSE", label: "가정전문간호사" },
            { value: "NURSE", label: "간호사(가정전문간호사 외)" },
            { value: "PHYSICAL_THERAPIST", label: "물리치료사" },
            { value: "OCCUPATIONAL_THERAPIST", label: "작업치료사" },
            OTHER_OPTION,
          ],
        },
        {
          key: "transport",
          label: "이동방법",
          type: "single",
          dictation: false,
          carryOver: true,
          description: "주요 이동방법 한 가지",
          options: [
            { value: "PUBLIC", label: "대중교통" },
            { value: "OWN_VEHICLE", label: "자가 이동수단" },
            { value: "WALK", label: "도보" },
          ],
        },
        {
          key: "distanceKm",
          label: "이동거리(편도)",
          type: "number",
          unit: "km",
          min: 0,
          max: 500,
          decimals: 0,
          dictation: false,
          carryOver: true,
        },
        {
          key: "travelTime",
          label: "이동 소요시간(편도)",
          type: "single",
          dictation: false,
          carryOver: true,
          options: [
            { value: "UNDER_10", label: "10분 미만" },
            { value: "FROM_10_TO_20", label: "10~20분 미만" },
            { value: "FROM_20_TO_30", label: "20~30분 미만" },
            { value: "OVER_30", label: "30분 이상" },
          ],
        },
        {
          key: "visitReason",
          label: "방문진료사유",
          type: "multi",
          required: true,
          dictation: true,
          question: "방문진료 사유는 무엇이었나요?",
          options: [
            { value: "SURGERY_CARE", label: "수술 관련 처치 필요" },
            { value: "ACUTE", label: "급성기질환(고열, 탈수 등)" },
            {
              value: "DEVICE",
              label: "의료기기 등 교체·관리",
              detail: { kind: "text", label: "종류" },
              hint: "유치도뇨관, 비위관 등. 괄호에 종류",
            },
            { value: "PRESSURE_ULCER", label: "욕창 관리" },
            {
              value: "NEURO_PSYCH",
              label: "신경정신과적 변동(뇌혈관질환, 심리상태 불안정 등)",
            },
            { value: "IV_FLUID", label: "수액 주입" },
            { value: "NUTRITION", label: "영양 관리" },
            OTHER_OPTION,
          ],
        },
      ],
    },
    {
      title: "진료 정보",
      fields: [
        {
          key: "treatment",
          label: "진료 및 조치 내용",
          type: "multi",
          required: true,
          dictation: true,
          question: "진료하거나 조치한 내용을 말씀해 주세요",
          options: [
            { value: "INVASIVE", label: "침습적 처치" },
            { value: "TEST", label: "검사 시행" },
            { value: "PRESCRIPTION", label: "처방전 발행" },
            { value: "ER_REFERRAL", label: "응급실 내원 권고" },
            { value: "CONSULT", label: "진찰 및 상담" },
            OTHER_OPTION,
          ],
        },
        {
          key: "plan",
          label: "향후 계획",
          type: "single",
          dictation: true,
          question: "향후 계획은 어떻게 되나요?",
          options: [
            { value: "DONE", label: "조치 완료" },
            { value: "REVISIT", label: "재방문 필요" },
            { value: "ADMISSION", label: "입원 치료 권고" },
            OTHER_OPTION,
          ],
        },
      ],
    },
    {
      title: "지역사회 연계",
      fields: [
        {
          key: "communityLink",
          label: "지역사회 연계 여부",
          type: "single",
          dictation: true,
          options: [
            { value: "LINKED", label: "연계" },
            { value: "NOT_LINKED", label: "미연계" },
          ],
        },
        {
          key: "communityLinkTargets",
          label: "연계 기관",
          type: "multi",
          dictation: true,
          description: "연계한 경우 모두 체크",
          options: [
            { value: "HEALTH_CENTER", label: "보건소" },
            { value: "LOCAL_GOVERNMENT", label: "지방자치단체(사회복지과 등)" },
            { value: "LOCAL_CLINIC", label: "지역의료기관" },
            OTHER_OPTION,
          ],
        },
      ],
    },
  ],
} as const satisfies FormDef;
