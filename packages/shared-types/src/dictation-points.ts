import { resolveFieldRef, type FormFieldRef } from "./dictation.js";
import type { FormId } from "./forms/index.js";
import type { Program } from "./programs.js";
import type { Profession } from "./roles.js";

/**
 * 구술할 내용 한 가지. topic 은 짧은 이름, hint 는 무엇을 말하면 되는지 한 줄이다.
 * fields 는 그 내용이 채우는 서식 칸("서식ID.칸키")이다. 방문에 없는 서식의 칸만 채우는 항목은 빼고,
 * 확정 전에 채울 칸이 있으면 필수로 표시한다.
 */
export interface DictationPoint {
  topic: string;
  hint: string;
  fields: readonly FormFieldRef[];
}

/**
 * 사업 × 직종별로 구술할 핵심(현장 웹 녹음 화면). 문장 예시 대신 무엇을 말하면 되는지만 짚는다.
 * 칸이 바뀌면 함께 고친다(PROGRAM_FORMS 의 규칙마다 있는지, fields 가 그 규칙 서식의 구술 칸인지,
 * 필수 칸과 되묻는 질문이 있는 칸을 모두 다루는지 테스트가 본다).
 */
export const DICTATION_POINTS: Record<
  Program,
  Partial<Record<Profession, readonly DictationPoint[]>>
> = {
  PRIMARY_CARE: {
    DOCTOR: [
      {
        topic: "방문 정보",
        hint: "예약 여부, 함께 간 인력(간호사 등)",
        fields: [
          "PRIMARY_CARE_CHECK.appointment",
          "PRIMARY_CARE_CHECK.companion",
        ],
      },
      {
        topic: "방문 사유",
        hint: "욕창·수액·급성기 질환·의료기기 교체 등",
        fields: ["PRIMARY_CARE_CHECK.visitReason"],
      },
      {
        topic: "진료·조치",
        hint: "진찰·상담, 침습적 처치, 검사, 처방전",
        fields: ["PRIMARY_CARE_CHECK.treatment"],
      },
      {
        topic: "계획·연계",
        hint: "재방문 여부, 지역사회 연계 기관",
        fields: [
          "PRIMARY_CARE_CHECK.plan",
          "PRIMARY_CARE_CHECK.communityLink",
          "PRIMARY_CARE_CHECK.communityLinkTargets",
        ],
      },
    ],
  },
  HOME_CARE_CENTER: {
    DOCTOR: [
      {
        topic: "방문 사유",
        hint: "정기·수시·응급, 동행자",
        fields: [
          "HOME_CARE_DOCTOR.visitReason",
          "HOME_CARE_DOCTOR.companion",
          "PRIMARY_CARE_CHECK.companion",
        ],
      },
      {
        topic: "기능 변화",
        hint: "신체·인지: 유지·호전·악화, 지금 수준",
        fields: [
          "HOME_CARE_DOCTOR.physicalTrend",
          "HOME_CARE_DOCTOR.physicalLevel",
          "HOME_CARE_DOCTOR.cognitiveTrend",
          "HOME_CARE_DOCTOR.cognitiveLevel",
        ],
      },
      {
        topic: "진찰·처치",
        hint: "진찰·상담, 침습적 처치, 처방·검사·전원",
        fields: [
          "HOME_CARE_DOCTOR.consultation",
          "HOME_CARE_DOCTOR.invasive",
          "HOME_CARE_DOCTOR.otherActions",
          "PRIMARY_CARE_CHECK.treatment",
        ],
      },
      {
        topic: "간호 지시",
        hint: "간호사에게 맡긴 관리",
        fields: ["HOME_CARE_DOCTOR.nursingOrders"],
      },
      {
        topic: "계획·총평",
        hint: "향후 계획, 오늘 상태 한 줄 평",
        fields: [
          "HOME_CARE_DOCTOR.plan",
          "HOME_CARE_DOCTOR.summary",
          "PRIMARY_CARE_CHECK.plan",
        ],
      },
      {
        topic: "방문진료 정보",
        hint: "예약 여부, 욕창·수액 등 진료 사유, 지역사회 연계",
        fields: [
          "PRIMARY_CARE_CHECK.appointment",
          "PRIMARY_CARE_CHECK.visitReason",
          "PRIMARY_CARE_CHECK.communityLink",
          "PRIMARY_CARE_CHECK.communityLinkTargets",
        ],
      },
    ],
    NURSE: [
      {
        topic: "방문 구분",
        hint: "정기·추가 방문, 동행자",
        fields: ["HOME_CARE_NURSE.visitType", "HOME_CARE_NURSE.companion"],
      },
      {
        topic: "활력징후",
        hint: "혈압·맥박·체온·혈당, 체중 변화",
        fields: [
          "HOME_CARE_NURSE.systolic",
          "HOME_CARE_NURSE.diastolic",
          "HOME_CARE_NURSE.pulse",
          "HOME_CARE_NURSE.temperature",
          "HOME_CARE_NURSE.glucose",
          "HOME_CARE_NURSE.weightChange",
        ],
      },
      {
        topic: "제공한 간호",
        hint: "투약·욕창·통증·영양 관리 등",
        fields: ["HOME_CARE_NURSE.care"],
      },
      {
        topic: "이상 여부",
        hint: "섬망·낙상·실금이 있었는지",
        fields: [
          "HOME_CARE_NURSE.delirium",
          "HOME_CARE_NURSE.fall",
          "HOME_CARE_NURSE.incontinence",
        ],
      },
      {
        topic: "계획·총평",
        hint: "향후 계획, 오늘 상태 한 줄 평",
        fields: ["HOME_CARE_NURSE.plan", "HOME_CARE_NURSE.summary"],
      },
    ],
    SOCIAL_WORKER: [
      {
        topic: "상담 방법",
        hint: "누구와(본인·가족), 방문·전화, 정기·수시",
        fields: [
          "HOME_CARE_SOCIAL.counselee",
          "HOME_CARE_SOCIAL.method",
          "HOME_CARE_SOCIAL.counselType",
        ],
      },
      {
        topic: "상담 내용",
        hint: "일정 조율, 환경 변화, 돌봄이 더 필요한지",
        fields: ["HOME_CARE_SOCIAL.content", "HOME_CARE_SOCIAL.counselDetail"],
      },
      {
        topic: "자원 연계",
        hint: "연계한 기관과 서비스",
        fields: [
          "HOME_CARE_SOCIAL.linkAgencies",
          "HOME_CARE_SOCIAL.linkServices",
          "HOME_CARE_SOCIAL.linkDetail",
        ],
      },
    ],
  },
  LTC_NURSING: {
    NURSE: [
      {
        topic: "활력징후",
        hint: "혈압·맥박·체온, 필요하면 호흡·혈당",
        fields: [
          "LTC_NURSING.systolic",
          "LTC_NURSING.diastolic",
          "LTC_NURSING.pulse",
          "LTC_NURSING.temperature",
          "LTC_NURSING.respiration",
          "LTC_NURSING.glucose",
        ],
      },
      {
        topic: "제공한 처치",
        hint: "처치마다 걸린 시간(예: 욕창 드레싱 15분)",
        fields: ["LTC_NURSING.healthCare", "LTC_NURSING.nursingCare"],
      },
      {
        topic: "상태·특이사항",
        hint: "상처 변화, 식사·수면, 교육한 내용",
        fields: ["LTC_NURSING.specialNote"],
      },
      {
        topic: "다음 계획",
        hint: "다음 방문 때 할 일",
        fields: ["LTC_NURSING.nextPlan"],
      },
    ],
  },
};

/** 이 방문에 보여 줄 구술 내용 한 가지. */
export interface VisitDictationPoint {
  topic: string;
  hint: string;
  /** 확정 전에 채울 칸이 있다 */
  required: boolean;
}

/** 이 방문의 구술 내용: 사업 × 방문한 직종의 항목에서 방문 서식의 칸을 채우는 것만. */
export function dictationPoints(
  program: Program,
  profession: Profession,
  formIds: readonly FormId[],
): VisitDictationPoint[] {
  const points = DICTATION_POINTS[program][profession] ?? [];
  return points.flatMap(({ topic, hint, fields }) => {
    const used = fields
      .flatMap((ref) => resolveFieldRef(ref) ?? [])
      .filter(({ formId }) => formIds.includes(formId));
    if (used.length === 0) return [];
    const required = used.some(({ field }) => field.required === true);
    return [{ topic, hint, required }];
  });
}
