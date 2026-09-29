import {
  BLOOD_PRESSURE_PAIR,
  DIASTOLIC_FIELD,
  GLUCOSE_FIELD,
  HOME_CARE_NURSING_ITEMS,
  HOME_CARE_PLAN_OPTIONS,
  PULSE_FIELD,
  SYSTOLIC_FIELD,
  TEMPERATURE_FIELD,
  YES_NO_OPTIONS,
} from "./common.js";
import type { FormDef } from "./engine.js";

const CONDITION_QUESTION = "섬망·낙상·실금이 있었나요?";

/**
 * 장기요양 재택의료센터 방문점검 기록지(간호사) — 재택의료센터 시범사업 지침 별지 제7호.
 * 원 서식은 한 장에 한 달 5회 방문을 칸으로 적는다. 여기서는 방문 1건이 한 칸이고,
 * 향후계획·총평은 방문마다 적어 두면 월간 서식에는 그 달 마지막 방문 값을 쓴다.
 */
export const HOME_CARE_NURSE_FORM = {
  id: "HOME_CARE_NURSE",
  code: "별지 제7호",
  title: "장기요양 재택의료센터 방문점검 기록지(간호사)",
  shortTitle: "방문점검 기록지(간호사)",
  submitTo: "공단 요양기관정보마당(재택의료센터 시범사업)",
  guide: [
    "정기 방문인지 추가 방문인지, 동행자",
    "제공한 간호(기초건강·투약·운동·영양·정신심리·통증·튜브·욕창)",
    "혈압·맥박·체온·혈당, 체중 변화",
    "섬망·낙상·실금 여부",
    "향후 계획과 총평",
  ],
  sttTerms: ["혈압", "맥박", "체온", "혈당", "섬망", "실금", "욕창"],
  numberPairs: [BLOOD_PRESSURE_PAIR],
  sections: [
    {
      title: "기본사항",
      fields: [
        {
          key: "visitType",
          label: "방문사유",
          type: "single",
          // 원본 월간 서식은 정기(1~2번 칸)·추가(3~5번 칸)로 칸을 나눠 적으므로 확정 전에 정한다.
          required: true,
          dictation: true,
          question: "정기 방문이었나요, 추가 방문(추가간호)이었나요?",
          hint: "정기·추가를 말하지 않았으면 비워 둔다",
          options: [
            { value: "REGULAR", label: "정기 방문" },
            { value: "ADDITIONAL", label: "추가 방문" },
          ],
        },
        {
          key: "companion",
          label: "동행자",
          type: "multi",
          dictation: true,
          carryOver: true,
          options: [
            { value: "DOCTOR", label: "의사" },
            { value: "SOCIAL_WORKER", label: "사회복지사" },
            { value: "OTHER", label: "기타" },
          ],
        },
      ],
    },
    {
      title: "방문내용",
      fields: [
        {
          key: "care",
          label: "방문내용",
          type: "multi",
          required: true,
          dictation: true,
          question: "오늘 제공한 간호 내용을 말씀해 주세요",
          options: HOME_CARE_NURSING_ITEMS.map((item) =>
            item.value === "PRESSURE_ULCER"
              ? { ...item, detail: { kind: "text" as const, label: "부위" } }
              : item,
          ),
        },
      ],
    },
    {
      title: "건강상태 확인",
      fields: [
        SYSTOLIC_FIELD,
        DIASTOLIC_FIELD,
        PULSE_FIELD,
        TEMPERATURE_FIELD,
        GLUCOSE_FIELD,
        {
          key: "weightChange",
          label: "체중 변화",
          type: "number",
          unit: "kg",
          min: -50,
          max: 50,
          decimals: 1,
          signed: true,
          dictation: true,
          hint: "늘었으면 양수, 줄었으면 음수. quote에는 숫자만",
        },
        {
          key: "delirium",
          label: "문제행동(섬망)",
          type: "single",
          dictation: true,
          question: CONDITION_QUESTION,
          options: YES_NO_OPTIONS,
        },
        {
          key: "fall",
          label: "낙상",
          type: "single",
          dictation: true,
          question: CONDITION_QUESTION,
          options: YES_NO_OPTIONS,
        },
        {
          key: "incontinence",
          label: "소변/대변실금",
          type: "single",
          dictation: true,
          question: CONDITION_QUESTION,
          options: YES_NO_OPTIONS,
        },
      ],
    },
    {
      title: "기타·향후 계획",
      fields: [
        {
          key: "notes",
          label: "기타 사항",
          type: "text",
          maxLength: 500,
          multiline: true,
          dictation: true,
        },
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
          hint: "수급자 상태와 관찰 내용을 간결한 기록체로",
        },
      ],
    },
  ],
} as const satisfies FormDef;
