import type { OriginalPdfFormId } from "@repo/shared-types";
import type { Rect } from "../pdf-draw.js";
import type { RecordTexts } from "../pdf-record.js";
import {
  basicInfo,
  box,
  circle,
  HOME_CARE_COVER,
  HOME_CARE_FOOTER,
  rect,
  type OverlayLayout,
  type TextSlot,
} from "./layout.js";

/*
 * 원본 위에 채우는 서식 자리. 제7호(간호사, 한 장에 방문 5칸)는 home-care-nurse.ts 가 따로 그린다.
 */

/** 방문일 년·월·일 칸(숫자를 칸 오른쪽, "년·월·일" 글자 앞에 붙인다). */
function visitDate(year: Rect, month: Rect, day: Rect): TextSlot[] {
  return [
    { id: "date.year", box: year, align: "right", text: (t) => t.date.year },
    { id: "date.month", box: month, align: "right", text: (t) => t.date.month },
    { id: "date.day", box: day, align: "right", text: (t) => t.date.day },
  ];
}

/** 시작·종료의 시(":" 앞, 오른쪽 붙임)·분 칸. */
function visitTime(at: "start" | "end", hour: Rect, minute: Rect): TextSlot[] {
  return [
    { id: `${at}.hour`, box: hour, align: "right", text: (t) => t[at].hour },
    { id: `${at}.minute`, box: minute, text: (t) => t[at].minute },
  ];
}

/** 제4호 진료 시간 줄: 년·월·일·시·분 글자 앞에 숫자를 쓴다(시각이 없으면 비운다, 시작·종료 같은 날). */
function primaryCareTimeRow(
  at: "start" | "end",
  y0: number,
  y1: number,
): TextSlot[] {
  const cell = (
    id: TextSlot["id"],
    x0: number,
    x1: number,
    value: (t: RecordTexts) => string,
  ): TextSlot => ({
    id,
    box: rect(x0, y0, x1, y1),
    align: "right",
    text: (t) => (t[at].text ? value(t) : ""),
  });
  return [
    cell(`${at}.year`, 381, 413.5, (t) => t.date.year),
    cell(`${at}.month`, 424, 442.5, (t) => t.date.month),
    cell(`${at}.day`, 452, 467.5, (t) => t.date.day),
    cell(`${at}.hour`, 480, 499.5, (t) => t[at].hour),
    cell(`${at}.minute`, 509, 523.5, (t) => t[at].minute),
  ];
}

/** [별지 제4호] 일차의료 방문진료 점검서식 — 글자가 윤곽선이라 좌표는 도형에서 뽑았다. */
const PRIMARY_CARE_CHECK_LAYOUT: OverlayLayout = {
  cover: [
    rect(279, 786, 317, 801), // 쪽 번호 "- 50 -"
    rect(465, 831, 595, 842), // 내려받기 표시
  ],
  footer: rect(58, 828, 460, 838),
  texts: [
    {
      id: "recipientName",
      box: rect(137, 109.8, 254, 124.2),
      text: (t) => t.recipientName,
    },
    // 2. 주민등록번호는 저장하지 않는다(심평원 재진 불러오기).
    {
      id: "address",
      box: rect(137, 175.3, 538, 189.1),
      text: (t) => t.address,
    },
    {
      id: "staffName",
      box: rect(143, 396.7, 259, 410.5),
      text: (t) => t.staffName,
    },
    {
      id: "licenseNumber",
      box: rect(381, 396.7, 538, 410.5),
      text: (t) => t.licenseNumber,
    },
    ...visitDate(
      rect(145, 417, 188.5, 431.5),
      rect(200, 417, 217, 431.5),
      rect(229, 417, 247, 431.5),
    ),
    ...primaryCareTimeRow("start", 410.5, 424.3),
    ...primaryCareTimeRow("end", 424.3, 438.1),
  ],
  fields: {
    ltcGrade: {
      kind: "options",
      options: {
        NONE: box(268.3, 131.2),
        GRADE_1: box(268.3, 144.1),
        GRADE_2: box(334.0, 144.1),
      },
    },
    bedridden: {
      kind: "options",
      options: { YES: box(268.3, 156.9), NO: box(333.7, 156.9) },
    },
    homeCareSupport: {
      kind: "options",
      options: { OXYGEN: box(268.3, 169.7), VENTILATOR: box(331.9, 169.7) },
    },
    sameBuilding: {
      kind: "options",
      options: {
        NONE: circle(267.4, 196.8),
        SAME_BUILDING: circle(349.5, 196.8),
        SAME_HOUSEHOLD: circle(436.5, 196.8),
      },
    },
    copayment: {
      kind: "options",
      options: { PARTIAL: circle(153.1, 233.3), FULL: circle(263.8, 233.3) },
    },
    mobility: {
      kind: "options",
      options: {
        PARALYSIS: box(147.1, 268.3),
        POST_SURGERY: box(147.1, 282.2),
        TERMINAL: box(147.1, 296.2),
        DEVICE: box(147.1, 310.3),
        NEURO_DEGENERATIVE: box(404.5, 268.3),
        PRESSURE_ULCER: box(404.5, 282.2),
        PSYCHIATRIC: box(404.5, 296.2),
        COGNITIVE: box(404.5, 310.3),
        OTHER: box(147.1, 323.1, rect(195, 317, 377, 330)),
      },
    },
    frequencyException: {
      kind: "options",
      options: {
        NONE: box(147.1, 335.8),
        TERMINAL_CANCER: box(147.1, 348.7),
        MULTIPLE_SCLEROSIS: box(208.9, 348.7),
        MYASTHENIA_GRAVIS: box(279.4, 348.7),
        CERVICAL_INJURY: box(350.1, 348.7),
        POST_SURGERY: box(403.1, 348.7),
        OTHER: box(147.1, 363.7, rect(178.5, 357, 333, 370)),
      },
    },
    appointment: {
      kind: "options",
      options: {
        SCHEDULED: circle(155.6, 390.7),
        UNSCHEDULED: circle(258.8, 390.7),
      },
    },
    companion: {
      kind: "options",
      options: {
        NONE: box(149.3, 445.6),
        HOME_CARE_NURSE: box(221.9, 445.6),
        NURSE: box(310.6, 445.6),
        PHYSICAL_THERAPIST: box(149.3, 460.6),
        OCCUPATIONAL_THERAPIST: box(220.4, 460.6),
        OTHER: box(310.1, 460.6, rect(341.5, 454, 394, 467)),
      },
    },
    transport: {
      kind: "options",
      options: {
        PUBLIC: circle(149.3, 486.2),
        OWN_VEHICLE: circle(213.5, 486.2),
        WALK: circle(301.1, 486.2),
      },
    },
    distanceKm: {
      kind: "number",
      box: rect(455, 470, 506, 487),
      align: "right",
    },
    travelTime: {
      kind: "options",
      options: {
        UNDER_10: circle(149.3, 508.3),
        FROM_10_TO_20: circle(224.1, 508.3),
        FROM_20_TO_30: circle(317.6, 508.3),
        OVER_30: circle(411.1, 508.3),
      },
    },
    visitReason: {
      kind: "options",
      options: {
        SURGERY_CARE: box(149.3, 543.3),
        ACUTE: box(149.3, 557.3),
        DEVICE: box(149.3, 571.3, rect(202.5, 579, 281, 592)),
        OTHER: box(149.3, 598.1, rect(197.5, 592, 379.5, 604)),
        PRESSURE_ULCER: box(300.1, 543.3),
        NEURO_PSYCH: box(300.1, 557.3),
        IV_FLUID: box(300.1, 571.3),
        NUTRITION: box(300.1, 585.3),
      },
    },
    treatment: {
      kind: "options",
      options: {
        INVASIVE: box(149.3, 637.6),
        TEST: box(270.1, 637.6),
        PRESCRIPTION: box(381.5, 637.6),
        ER_REFERRAL: box(149.3, 652.6),
        CONSULT: box(268.9, 652.6),
        OTHER: box(379.7, 652.6, rect(433, 646, 515, 659)),
      },
    },
    plan: {
      kind: "options",
      options: {
        DONE: circle(149.3, 665.9),
        REVISIT: circle(231.3, 665.9),
        ADMISSION: circle(317.7, 665.9),
        OTHER: circle(423.5, 665.9, rect(462, 660, 499.5, 672)),
      },
    },
    communityLink: {
      kind: "options",
      options: {
        LINKED: circle(149.3, 693.0),
        NOT_LINKED: circle(212.5, 693.0),
      },
    },
    communityLinkTargets: {
      kind: "options",
      options: {
        HEALTH_CENTER: box(153.7, 718.7),
        LOCAL_GOVERNMENT: box(209.2, 718.7),
        LOCAL_CLINIC: box(349.0, 718.7),
        // 원본은 ④기타만 ○다.
        OTHER: circle(436.6, 718.7, rect(481, 712, 510, 725)),
      },
    },
  },
};

/** [별지 제6호] 장기요양 재택의료센터 방문점검 기록지(의사) */
const HOME_CARE_DOCTOR_LAYOUT: OverlayLayout = {
  cover: HOME_CARE_COVER,
  footer: HOME_CARE_FOOTER,
  texts: [
    ...visitDate(
      rect(230, 150.6, 282, 169.9),
      rect(297, 150.6, 321, 169.9),
      rect(335.5, 150.6, 359, 169.9),
    ),
    ...basicInfo(
      { left: [222, 326], right: [431, 535] },
      [169.9, 189.0, 210.6, 229.8, 249.1],
    ),
    {
      id: "staffName",
      box: rect(169, 272.2, 229, 293.8),
      text: (t) => t.staffName,
    },
    {
      id: "profession",
      box: rect(298, 272.2, 371, 293.8),
      text: (t) => t.profession,
    },
    {
      id: "licenseNumber",
      box: rect(461, 272.2, 535, 293.8),
      text: (t) => t.licenseNumber,
    },
    ...visitTime(
      "start",
      rect(292, 315.3, 330, 341.3),
      rect(337, 315.3, 369, 341.3),
    ),
    ...visitTime(
      "end",
      rect(458, 315.3, 496, 341.3),
      rect(503, 315.3, 535, 341.3),
    ),
  ],
  fields: {
    companion: {
      kind: "options",
      options: {
        NURSE: box(173.2, 305.6),
        SOCIAL_WORKER: box(236.7, 305.6),
        OTHER: box(322.2, 305.6),
      },
    },
    visitReason: {
      kind: "options",
      options: {
        REGULAR: circle(212.9, 353.2),
        ADHOC: circle(254.8, 353.2),
        EMERGENCY: circle(302.3, 353.2),
        OTHER: circle(349.7, 353.2, rect(391.7, 341.3, 460, 362.8)),
      },
    },
    physicalTrend: {
      kind: "options",
      options: {
        MAINTAINED: circle(212.9, 377.9),
        IMPROVED: circle(254.8, 377.9),
        WORSENED: circle(212.9, 393.4),
      },
    },
    physicalLevel: {
      kind: "options",
      options: {
        INDEPENDENT: circle(299.7, 377.9),
        INDOOR_INDEPENDENT: circle(368.4, 377.9),
        INDOOR_SOME_HELP: circle(437.1, 377.9),
        INDOOR_MUCH_HELP: circle(299.7, 393.4),
        INDOOR_FULL_HELP: circle(402.1, 393.4),
      },
    },
    cognitiveTrend: {
      kind: "options",
      options: {
        MAINTAINED: circle(212.9, 423.6),
        IMPROVED: circle(254.8, 423.6),
        WORSENED: circle(212.9, 438.9),
      },
    },
    cognitiveLevel: {
      kind: "options",
      options: {
        INDEPENDENT: circle(299.7, 423.6),
        WEEKLY_1_2: circle(369.1, 423.6),
        WEEKLY_3_4: circle(299.7, 438.9),
        DAILY: circle(401.1, 438.9),
        SEVERE: circle(481.0, 438.9),
      },
    },
    consultation: {
      kind: "options",
      options: {
        DISEASE: box(212.9, 469.1),
        EXERCISE: box(276.4, 469.1),
        FALL: box(317.9, 469.1),
        INFECTION: box(381.3, 469.1),
        IV_FLUID: box(444.9, 469.1),
        NUTRITION: box(212.9, 484.6),
        PAIN: box(276.4, 484.6),
        DRUG_SIDE_EFFECT: box(339.8, 484.6),
        CHECKUP: box(419.8, 484.6),
        PRESSURE_ULCER: box(212.9, 499.9),
        EMERGENCY: box(276.4, 499.9),
        OTHER: box(339.8, 499.9, rect(376, 492, 455, 507)),
      },
    },
    invasive: {
      kind: "text",
      box: rect(248, 523, 519, 537),
      mark: { x: 212.9, y: 530.2 },
    },
    otherActions: {
      kind: "options",
      options: {
        PRESCRIPTION: box(212.9, 560.7),
        TEST: box(303.9, 560.7, rect(369, 553, 523, 568)),
        TRANSFER: box(212.9, 576.0),
        OTHER: box(303.9, 576.0, rect(339, 568.5, 523, 583.5)),
      },
    },
    nursingOrders: {
      kind: "options",
      options: {
        BASIC_HEALTH: box(212.9, 604.0),
        MEDICATION: box(298.3, 604.0),
        EXERCISE: box(361.9, 604.0),
        NUTRITION: box(425.3, 604.0),
        PSYCH: box(212.9, 619.4),
        PAIN: box(298.3, 619.4),
        TUBE: box(361.9, 619.4),
        PRESSURE_ULCER: box(425.3, 619.4),
      },
    },
    notes: { kind: "text", box: rect(119, 635, 535, 673), multiline: true },
    plan: {
      kind: "options",
      options: {
        CONTINUE: circle(212.9, 693.6),
        REASSESS: circle(276.9, 693.6),
        CASE_MEETING: circle(329.8, 693.6),
        PLAN_CHANGE: circle(410.1, 693.6),
        CLOSE: circle(479.6, 693.6),
        OTHER: circle(212.9, 709.1, rect(249.5, 702, 328, 716)),
      },
    },
    summary: { kind: "text", box: rect(209, 728, 535, 773), multiline: true },
  },
};

/** [별지 제8호] 장기요양 재택의료센터 업무 기록지(사회복지사) */
const HOME_CARE_SOCIAL_LAYOUT: OverlayLayout = {
  cover: HOME_CARE_COVER,
  footer: HOME_CARE_FOOTER,
  texts: [
    ...basicInfo(
      { left: [195, 324], right: [418, 536] },
      [134.6, 151.5, 168.5, 185.6, 202.5],
    ),
    ...visitDate(
      rect(194, 223, 228, 240),
      rect(242.5, 223, 256, 240),
      rect(269.5, 223, 283, 240),
    ),
    ...visitTime("start", rect(362, 223, 386, 240), rect(392, 223, 418, 240)),
    ...visitTime("end", rect(481, 223, 504, 240), rect(510, 223, 537, 240)),
    {
      id: "staffName",
      box: rect(195, 240, 324, 256.9),
      text: (t) => t.staffName,
    },
    {
      id: "licenseNumber",
      box: rect(418, 240, 536, 256.9),
      text: (t) => t.licenseNumber,
    },
  ],
  fields: {
    counselee: {
      kind: "options",
      options: {
        RECIPIENT: circle(201.7, 266.5),
        FAMILY: circle(334.1, 266.5, rect(395, 258, 417, 274)),
      },
    },
    method: {
      kind: "options",
      options: { VISIT: circle(201.7, 286.3), PHONE: circle(249.2, 286.3) },
    },
    counselType: {
      kind: "options",
      options: { REGULAR: circle(425.3, 286.3), ADHOC: circle(472.7, 286.3) },
    },
    content: {
      kind: "options",
      options: {
        PROGRAM_INFO: box(201.7, 306.2),
        SCHEDULE: box(317.3, 306.2),
        ENVIRONMENT: box(432.8, 306.2),
        NEED_ASSESSMENT: box(201.7, 323.1),
        LINK_PROVIDED: {
          ...box(201.7, 340.1),
          detailChoices: {
            INFO: { x: 340.0, y: 340.1 },
            REFERRAL: { x: 406.2, y: 340.1 },
          },
        },
        OTHER: box(201.7, 357.2, rect(238, 350, 525, 364)),
      },
    },
    counselDetail: {
      kind: "text",
      box: rect(197, 382, 535, 453),
      multiline: true,
    },
    linkAgencies: {
      kind: "options",
      options: {
        CITY_HALL: box(201.7, 465.2),
        COMMUNITY_CENTER: box(317.3, 465.2),
        HEALTH_CENTER: box(432.8, 465.2),
        NHIS_LTC: box(201.7, 482.2),
        PUBLIC_AGENCY: box(432.8, 482.2),
        LTC_PROVIDER: box(201.7, 499.1),
        ELDER_PROTECTION: box(432.8, 499.1),
        WELFARE_CENTER: box(201.7, 516.1),
        SENIOR_CENTER: box(317.3, 516.1),
        DISABILITY_CENTER: box(432.8, 516.1),
        DEMENTIA_CENTER: box(201.7, 533.1),
        PRIVATE_COMPANY: box(317.3, 533.1),
        OTHER: box(432.8, 533.1, rect(467, 526, 527.7, 539)),
      },
    },
    linkServices: {
      kind: "options",
      options: {
        FAMILY_COUNSEL: box(201.7, 550.0),
        CARE_EDUCATION: box(317.3, 550.0, rect(373.5, 543, 413.2, 556)),
        DEMENTIA_EDUCATION: box(432.8, 550.0, rect(489, 543, 528.7, 556)),
        FINANCIAL: box(201.7, 567.0, rect(273.7, 560, 297.6, 573)),
        ORAL_CARE: box(317.3, 567.0),
        REHAB: box(432.8, 567.0),
        HOUSING: box(201.7, 584.1),
        MEAL: box(317.3, 584.1),
        DONATION: box(432.8, 584.1),
        ELDER_CARE: box(201.7, 601.0),
        BEFRIENDING: box(432.8, 601.0),
        SOCIAL_ACTIVITY: box(201.7, 618.0),
        ABUSE_REPORT: box(432.8, 618.0),
        OTHER: box(201.7, 635.0, rect(236.7, 628, 524.5, 641)),
      },
    },
    linkDetail: {
      kind: "text",
      box: rect(197, 661, 535, 731),
      multiline: true,
    },
    notes: { kind: "text", box: rect(197, 735, 535, 767), multiline: true },
  },
};

/** 원본 위에 칸 자리로 채우는 서식(제7호는 home-care-nurse.ts). */
export const OVERLAY_LAYOUTS = {
  PRIMARY_CARE_CHECK: PRIMARY_CARE_CHECK_LAYOUT,
  HOME_CARE_DOCTOR: HOME_CARE_DOCTOR_LAYOUT,
  HOME_CARE_SOCIAL: HOME_CARE_SOCIAL_LAYOUT,
} satisfies Record<
  Exclude<OriginalPdfFormId, "HOME_CARE_NURSE">,
  OverlayLayout
>;
