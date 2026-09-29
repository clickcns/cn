import { OTHER_OPTION } from "./common.js";
import type { FormDef } from "./engine.js";

/**
 * 장기요양 재택의료센터 업무 기록지(사회복지사) — 재택의료센터 시범사업 지침 별지 제8호.
 * 방문·유선 상담 모두 적는다. 공단 요양기관정보마당에 등록하고, 원본은 기관이 5년 보관한다.
 */
export const HOME_CARE_SOCIAL_FORM = {
  id: "HOME_CARE_SOCIAL",
  code: "별지 제8호",
  title: "장기요양 재택의료센터 업무 기록지(사회복지사)",
  shortTitle: "업무 기록지(사회복지사)",
  submitTo: "공단 요양기관정보마당(재택의료센터 시범사업)",
  guide: [
    "누구와(수급자·가족) 어떻게(방문·유선) 상담했는지, 정기·수시",
    "상담 내용(사업 안내, 일정 조율, 환경 변화, 자원연계 필요도·제공)",
    "연계한 기관과 서비스",
    "특이사항",
  ],
  sttTerms: ["상담", "유선", "자원연계", "주민센터", "치매안심센터"],
  sections: [
    {
      title: "상담",
      fields: [
        {
          key: "counselee",
          label: "피상담자",
          type: "single",
          dictation: true,
          question: "누구와 상담했나요? (수급자 본인 또는 가족)",
          options: [
            { value: "RECIPIENT", label: "수급자" },
            {
              value: "FAMILY",
              label: "가족",
              detail: { kind: "text", label: "관계" },
            },
          ],
        },
        {
          key: "method",
          label: "상담방법",
          type: "single",
          required: true,
          dictation: true,
          question: "방문 상담이었나요, 전화 상담이었나요?",
          options: [
            { value: "VISIT", label: "방문" },
            { value: "PHONE", label: "유선", hint: "전화 상담" },
          ],
        },
        {
          key: "counselType",
          label: "상담구분",
          type: "single",
          dictation: true,
          options: [
            { value: "REGULAR", label: "정기" },
            { value: "ADHOC", label: "수시" },
          ],
        },
        {
          key: "content",
          label: "상담내용",
          type: "multi",
          required: true,
          dictation: true,
          question: "어떤 내용을 상담했나요?",
          options: [
            { value: "PROGRAM_INFO", label: "사업안내" },
            { value: "SCHEDULE", label: "방문일정 조율" },
            { value: "ENVIRONMENT", label: "환경변화 파악" },
            {
              value: "NEED_ASSESSMENT",
              label: "지역사회 자원연계 필요도 파악(요양, 돌봄 등)",
            },
            {
              value: "LINK_PROVIDED",
              label: "지역사회 자원연계 제공",
              detail: {
                kind: "choice",
                label: "방식",
                options: [
                  { value: "INFO", label: "정보제공" },
                  { value: "REFERRAL", label: "기관연계" },
                ],
              },
            },
            OTHER_OPTION,
          ],
        },
        {
          key: "counselDetail",
          label: "상담 상세내용",
          type: "text",
          maxLength: 1000,
          multiline: true,
          dictation: true,
          question: "상담 내용을 자세히 말씀해 주세요",
          hint: "특이사항 등 상담 내용을 간결한 기록체로",
        },
      ],
    },
    {
      title: "지역사회 자원연계",
      fields: [
        {
          key: "linkAgencies",
          label: "연계기관",
          type: "multi",
          dictation: true,
          options: [
            { value: "CITY_HALL", label: "시군구청" },
            { value: "COMMUNITY_CENTER", label: "행정복지주민센터" },
            { value: "HEALTH_CENTER", label: "보건소" },
            {
              value: "NHIS_LTC",
              label: "국민건강보험공단 장기요양운영센터",
            },
            { value: "PUBLIC_AGENCY", label: "지역 내 공공기관" },
            {
              value: "LTC_PROVIDER",
              label: "장기요양기관(방문간호 등 재가기관)",
            },
            { value: "ELDER_PROTECTION", label: "노인보호전문기관" },
            { value: "WELFARE_CENTER", label: "종합사회복지관" },
            { value: "SENIOR_CENTER", label: "노인복지관" },
            { value: "DISABILITY_CENTER", label: "장애인복지관" },
            { value: "DEMENTIA_CENTER", label: "치매안심센터" },
            { value: "PRIVATE_COMPANY", label: "민간기업" },
            OTHER_OPTION,
          ],
        },
        {
          key: "linkServices",
          label: "연계내용",
          type: "multi",
          dictation: true,
          options: [
            { value: "FAMILY_COUNSEL", label: "장기요양 가족상담" },
            {
              value: "CARE_EDUCATION",
              label: "돌봄교육",
              detail: { kind: "text", label: "내용" },
            },
            {
              value: "DEMENTIA_EDUCATION",
              label: "치매교육",
              detail: { kind: "text", label: "내용" },
            },
            {
              value: "FINANCIAL",
              label: "경제적 지원",
              detail: { kind: "text", label: "내용" },
            },
            { value: "ORAL_CARE", label: "방문구강서비스" },
            { value: "REHAB", label: "방문재활서비스" },
            { value: "HOUSING", label: "주거환경 개선" },
            { value: "MEAL", label: "도시락배달" },
            { value: "DONATION", label: "후원물품 전달" },
            { value: "ELDER_CARE", label: "노인돌봄 및 지원서비스 사업" },
            { value: "BEFRIENDING", label: "말벗서비스" },
            {
              value: "SOCIAL_ACTIVITY",
              label: "사회활동 및 여가활동 지원사업",
            },
            { value: "ABUSE_REPORT", label: "노인 학대신고" },
            OTHER_OPTION,
          ],
        },
        {
          key: "linkDetail",
          label: "연계 상세내용",
          type: "text",
          maxLength: 1000,
          multiline: true,
          dictation: true,
        },
      ],
    },
    {
      title: "기타",
      fields: [
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
  ],
} as const satisfies FormDef;
