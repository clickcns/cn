import { formFieldLabels, type FormFieldRef } from "./dictation.js";
import type { FormId } from "./forms/index.js";
import type { Program } from "./programs.js";
import type { Profession } from "./roles.js";

/**
 * 구술 예시 한 줄. text 는 따라 말할 문장이고 "{이름}"은 수급자 이름으로 바꿔 보여 준다.
 * fields 는 그 문장이 채우는 서식 칸("서식ID.칸키")이다. 화면의 칸 이름은 서식 정의에서 가져오고,
 * 방문에 없는 서식의 칸만 채우는 줄은 뺀다. 빠진 항목 안내도 이 칸으로 예시를 찾는다.
 */
export interface DictationExampleLine {
  text: string;
  fields: readonly FormFieldRef[];
}

/**
 * 사업 × 직종별 구술 예시(현장 웹 녹음 화면). 서식 정의의 guide 가 "무엇을" 말할지라면 이것은
 * "어떻게" 말하는지 보여 주는 가상 예시다. 칸이 바뀌면 함께 고친다(PROGRAM_FORMS 의 규칙마다 예시가
 * 있는지, fields 가 그 규칙 서식의 구술 칸인지 테스트가 본다).
 */
export const DICTATION_EXAMPLES: Record<
  Program,
  Partial<Record<Profession, readonly DictationExampleLine[]>>
> = {
  PRIMARY_CARE: {
    DOCTOR: [
      {
        text: "{이름} 님 댁에 예약된 방문진료로 간호사와 함께 갔습니다.",
        fields: [
          "PRIMARY_CARE_CHECK.appointment",
          "PRIMARY_CARE_CHECK.companion",
        ],
      },
      {
        text: "유치도뇨관 교체와 천골 욕창 관리 때문에 방문했습니다.",
        fields: ["PRIMARY_CARE_CHECK.visitReason"],
      },
      {
        text: "욕창을 소독하고 도뇨관을 교체했습니다. 진찰하고 처방전을 발행했습니다.",
        fields: ["PRIMARY_CARE_CHECK.treatment"],
      },
      {
        text: "2주 뒤 다시 방문할 예정입니다.",
        fields: ["PRIMARY_CARE_CHECK.plan"],
      },
      {
        text: "보건소 방문재활 프로그램에 연계했습니다.",
        fields: [
          "PRIMARY_CARE_CHECK.communityLink",
          "PRIMARY_CARE_CHECK.communityLinkTargets",
        ],
      },
    ],
  },
  HOME_CARE_CENTER: {
    DOCTOR: [
      {
        text: "{이름} 님 댁에 정기 방문했고 간호사가 동행했습니다.",
        fields: [
          "HOME_CARE_DOCTOR.visitReason",
          "HOME_CARE_DOCTOR.companion",
          "PRIMARY_CARE_CHECK.companion",
        ],
      },
      {
        text: "예약된 방문이었고, 욕창 관리와 영양 관리 때문에 방문했습니다.",
        fields: [
          "PRIMARY_CARE_CHECK.appointment",
          "PRIMARY_CARE_CHECK.visitReason",
        ],
      },
      {
        text: "신체 기능은 지난번과 비슷하게 유지되고, 실내에서 많은 도움이 필요합니다.",
        fields: [
          "HOME_CARE_DOCTOR.physicalTrend",
          "HOME_CARE_DOCTOR.physicalLevel",
        ],
      },
      {
        text: "인지 기능은 조금 나빠져서 매일 관찰이 필요합니다.",
        fields: [
          "HOME_CARE_DOCTOR.cognitiveTrend",
          "HOME_CARE_DOCTOR.cognitiveLevel",
        ],
      },
      {
        text: "질병 관리와 통증 관리에 대해 진찰하고 상담했습니다.",
        fields: [
          "HOME_CARE_DOCTOR.consultation",
          "PRIMARY_CARE_CHECK.treatment",
        ],
      },
      {
        text: "천골 욕창의 괴사 조직을 제거했고 처방전을 발행했습니다.",
        fields: [
          "HOME_CARE_DOCTOR.invasive",
          "HOME_CARE_DOCTOR.otherActions",
          "PRIMARY_CARE_CHECK.treatment",
        ],
      },
      {
        text: "간호사에게 욕창 관리와 투약 관리를 지시했습니다.",
        fields: ["HOME_CARE_DOCTOR.nursingOrders"],
      },
      {
        text: "향후 계획은 관리 지속입니다. 전반적으로 안정적이지만 욕창 회복이 더뎌 2주 뒤 다시 보겠습니다.",
        fields: [
          "HOME_CARE_DOCTOR.plan",
          "HOME_CARE_DOCTOR.summary",
          "PRIMARY_CARE_CHECK.plan",
        ],
      },
    ],
    NURSE: [
      {
        text: "{이름} 님 댁에 정기 방문했고 동행자는 없었습니다.",
        fields: ["HOME_CARE_NURSE.visitType", "HOME_CARE_NURSE.companion"],
      },
      {
        text: "혈압 130에 80, 맥박 76, 체온 36.5도, 혈당 142였습니다.",
        fields: [
          "HOME_CARE_NURSE.systolic",
          "HOME_CARE_NURSE.diastolic",
          "HOME_CARE_NURSE.pulse",
          "HOME_CARE_NURSE.temperature",
          "HOME_CARE_NURSE.glucose",
        ],
      },
      {
        text: "체중은 지난달보다 1킬로 줄었습니다.",
        fields: ["HOME_CARE_NURSE.weightChange"],
      },
      {
        text: "기초 건강관리와 투약 관리를 했고 천골 욕창을 소독했습니다.",
        fields: ["HOME_CARE_NURSE.care"],
      },
      {
        text: "섬망, 낙상, 실금은 없었습니다.",
        fields: [
          "HOME_CARE_NURSE.delirium",
          "HOME_CARE_NURSE.fall",
          "HOME_CARE_NURSE.incontinence",
        ],
      },
      {
        text: "관리를 지속하겠습니다. 활력징후는 안정적이고 욕창은 조금 좋아졌습니다.",
        fields: ["HOME_CARE_NURSE.plan", "HOME_CARE_NURSE.summary"],
      },
    ],
    SOCIAL_WORKER: [
      {
        text: "{이름} 님 따님과 전화로 정기 상담을 했습니다.",
        fields: [
          "HOME_CARE_SOCIAL.counselee",
          "HOME_CARE_SOCIAL.method",
          "HOME_CARE_SOCIAL.counselType",
        ],
      },
      {
        text: "다음 방문 일정을 조율하고, 돌봄 서비스가 더 필요한지 파악했습니다.",
        fields: ["HOME_CARE_SOCIAL.content"],
      },
      {
        text: "따님이 낮 시간 돌봄이 어렵다고 해서 행정복지센터에 노인맞춤돌봄 서비스를 연계했습니다.",
        fields: [
          "HOME_CARE_SOCIAL.counselDetail",
          "HOME_CARE_SOCIAL.linkAgencies",
          "HOME_CARE_SOCIAL.linkServices",
          "HOME_CARE_SOCIAL.linkDetail",
        ],
      },
      {
        text: "그 밖의 특이사항은 없습니다.",
        fields: ["HOME_CARE_SOCIAL.notes"],
      },
    ],
  },
  LTC_NURSING: {
    NURSE: [
      {
        text: "{이름} 님 혈압 128에 76, 맥박 72, 체온 36.4도, 호흡 18회였습니다.",
        fields: [
          "LTC_NURSING.systolic",
          "LTC_NURSING.diastolic",
          "LTC_NURSING.pulse",
          "LTC_NURSING.temperature",
          "LTC_NURSING.respiration",
        ],
      },
      {
        text: "투약 관리 10분, 관절 운동 10분, 욕창 드레싱 15분 했습니다.",
        fields: ["LTC_NURSING.healthCare", "LTC_NURSING.nursingCare"],
      },
      {
        text: "천골 욕창은 2센티에서 1.5센티로 줄었고 삼출물은 적었습니다.",
        fields: ["LTC_NURSING.specialNote"],
      },
      {
        text: "보호자 말로는 요즘 식사량이 줄었다고 해서 수분 섭취를 교육했습니다.",
        fields: ["LTC_NURSING.specialNote"],
      },
      {
        text: "다음 주 화요일에 다시 방문해 욕창 상태를 확인하겠습니다.",
        fields: ["LTC_NURSING.nextPlan"],
      },
    ],
  },
};

/** 이 방문에 보여 줄 예시 한 줄: 방문 서식의 칸만 남기고, 칸 이름(fills)을 붙인다. */
export interface VisitDictationExampleLine {
  text: string;
  fields: FormFieldRef[];
  fills: string[];
}

const NAME_TOKEN = "{이름}";

/**
 * 이 방문의 구술 예시: 사업 × 방문한 직종의 예시에서 방문 서식의 칸을 채우는 줄만, "{이름}"은 수급자
 * 이름으로.
 */
export function dictationExample(
  program: Program,
  profession: Profession,
  formIds: readonly FormId[],
  recipientName: string,
): VisitDictationExampleLine[] {
  const lines = DICTATION_EXAMPLES[program][profession] ?? [];
  return lines.flatMap((line) => {
    const fields = line.fields.filter((ref) =>
      formIds.some((formId) => ref.startsWith(`${formId}.`)),
    );
    if (fields.length === 0) return [];
    return [
      {
        text: line.text.replaceAll(NAME_TOKEN, recipientName),
        fields,
        fills: formFieldLabels(fields),
      },
    ];
  });
}
