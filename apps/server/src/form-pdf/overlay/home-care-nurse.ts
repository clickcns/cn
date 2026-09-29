import {
  popGraphicsState,
  pushGraphicsState,
  translate,
  type PDFDocument,
  type PDFPage,
} from "pdf-lib";
import {
  cover,
  drawFooter,
  drawLine,
  drawRing,
  type Fonts,
} from "../pdf-draw.js";
import {
  footerText,
  numberValue,
  recordTexts,
  selectedOptions,
  type PdfVisitRecord,
  type RecordTexts,
} from "../pdf-record.js";
import {
  basicInfo,
  box,
  circle,
  HOME_CARE_COVER,
  HOME_CARE_FOOTER,
  rect,
  type FieldSlot,
  type TextItem,
} from "./layout.js";
import { addTemplatePage, drawField, drawTexts } from "./render.js";

/*
 * [별지 제7호] 장기요양 재택의료센터 방문점검 기록지(간호사). 원본은 한 장에 한 달 방문 5칸이다.
 * 방문 한 건은 첫 칸에, 월간 기록지는 그 달 확정 방문을 날짜순으로 칸에 채운다(5건이 넘으면 다음 장).
 * 방문사유는 칸에 쓴 방문의 값을 모두 표시하고, 향후계획·총평은 그 달 마지막 방문 값을 쓴다.
 */

/** 방문 칸 5개의 왼쪽 선(pt). 칸 너비는 약 72.6pt. 칸은 모두 첫 칸 좌표로 적고 옮겨 그린다. */
const COLUMN_LEFTS = [175.2, 247.8, 320.5, 393.0, 465.7] as const;

const VISITS_PER_PAGE = COLUMN_LEFTS.length;

/** 첫 칸의 왼쪽 선 기준 좌표로 Rect. */
const col = (x0: number, y0: number, x1: number, y1: number) =>
  rect(COLUMN_LEFTS[0] + x0, y0, COLUMN_LEFTS[0] + x1, y1);

/** 방문 칸마다 그리는 칸(첫 칸 좌표). */
export const NURSE_COLUMN_FIELDS: Record<string, FieldSlot> = {
  companion: {
    kind: "options",
    options: {
      DOCTOR: box(184.8, 350.7),
      SOCIAL_WORKER: box(184.8, 364.9),
      OTHER: box(184.8, 379.3),
    },
  },
  care: {
    kind: "options",
    options: {
      BASIC_HEALTH: box(211.5, 397.1),
      MEDICATION: box(211.5, 417.3),
      EXERCISE: box(211.5, 437.6),
      NUTRITION: box(211.5, 458.0),
      PSYCH: box(211.5, 478.9),
      PAIN: box(211.5, 500.0),
      TUBE: box(211.5, 520.3),
      PRESSURE_ULCER: box(187.9, 541.6, rect(198.5, 535, 236, 548)),
    },
  },
  delirium: {
    kind: "options",
    options: { YES: circle(187.0, 628.5), NO: circle(220.5, 628.5) },
  },
  fall: {
    kind: "options",
    options: { YES: circle(187.0, 646.9), NO: circle(220.5, 646.9) },
  },
  incontinence: {
    kind: "options",
    options: { YES: circle(187.0, 666.7), NO: circle(220.5, 666.7) },
  },
  pulse: {
    kind: "number",
    box: col(2, 568, 41, 581),
    align: "right",
    size: 7.5,
  },
  notes: {
    kind: "text",
    box: col(2.5, 677.5, 70, 696.5),
    multiline: true,
    size: 6.5,
  },
};

/** 장마다 한 번 그리는 칸(방문사유는 칸의 방문을 모아서, 향후계획은 마지막 방문 값). */
export const NURSE_PAGE_FIELDS: Record<string, FieldSlot> = {
  visitType: {
    kind: "options",
    options: {
      REGULAR: circle(184.8, 246.0),
      ADDITIONAL: circle(330.0, 246.0),
    },
  },
  plan: {
    kind: "options",
    options: {
      CONTINUE: circle(184.8, 708.1),
      REASSESS: circle(248.7, 708.1),
      CASE_MEETING: circle(301.7, 708.1),
      PLAN_CHANGE: circle(382.1, 708.1),
      CLOSE: circle(451.5, 708.1),
      OTHER: circle(184.8, 725.6, rect(221, 718, 301, 730)),
    },
  },
  summary: { kind: "text", box: rect(178, 737, 535, 771), multiline: true },
};

/** 칸 자리가 아니라 drawColumnValues 가 그리는 칸(혈압 짝·체온/혈당·체중 변화). 칸 확인 테스트가 쓴다. */
export const NURSE_DRAWN_FIELDS = [
  "systolic",
  "diastolic",
  "temperature",
  "glucose",
  "weightChange",
] as const;

function columnTexts(t: RecordTexts): TextItem[] {
  return [
    { text: t.date.day, box: col(2, 254.1, 56, 272), align: "right" },
    {
      text: t.staffName,
      box: col(2, 272, 70.6, 289.5),
      align: "center",
      size: 8,
    },
    {
      text: t.licenseNumber,
      box: col(2, 289.5, 70.6, 307),
      align: "center",
      size: 7.5,
    },
    {
      text: t.start.hour,
      box: col(4, 307, 33.6, 324.1),
      align: "right",
      size: 8.5,
    },
    { text: t.start.minute, box: col(37, 307, 70, 324.1), size: 8.5 },
    {
      text: t.end.hour,
      box: col(4, 324.1, 33.6, 341.3),
      align: "right",
      size: 8.5,
    },
    { text: t.end.minute, box: col(37, 324.1, 70, 341.3), size: 8.5 },
  ];
}

/** 혈압 짝·체온/혈당·체중 변화(칸 하나, 첫 칸 좌표). */
function drawColumnValues(
  page: PDFPage,
  fonts: Fonts,
  record: PdfVisitRecord,
): void {
  const { data } = record;
  const small = { font: fonts.regular, size: 7.5, align: "right" } as const;
  const systolic = numberValue(data, "systolic");
  const diastolic = numberValue(data, "diastolic");
  if (systolic !== null || diastolic !== null) {
    drawLine(
      page,
      `${systolic ?? ""}/${diastolic ?? ""}`,
      col(2, 552.5, 34, 566.5),
      small,
    );
  }
  // 원본은 "℃/ mg/㎗" 사이가 좁아 숫자를 넣을 수 없다. 값이 있으면 칸을 다시 쓴다.
  const temperature = numberValue(data, "temperature");
  const glucose = numberValue(data, "glucose");
  if (temperature !== null || glucose !== null) {
    cover(page, col(1.5, 583.2, 71.2, 598.6));
    drawLine(
      page,
      `${temperature ?? ""}℃ / ${glucose ?? ""}mg/dL`,
      col(2, 581.5, 70.6, 599.8),
      { font: fonts.regular, size: 7, align: "center" },
    );
  }
  // 체중 변화: "증/감" 중 하나에 동그라미, kg 앞에 크기.
  const weight = numberValue(data, "weightChange");
  if (weight !== null) {
    const left = COLUMN_LEFTS[0];
    if (weight > 0) drawRing(page, { x: left + 15.8, y: 609.5 });
    if (weight < 0) drawRing(page, { x: left + 27, y: 609.5 });
    drawLine(page, String(Math.abs(weight)), col(30, 600.5, 57, 617.5), small);
  }
}

/** 방문 한 건을 index 번째 칸에 그린다(첫 칸 좌표를 칸 간격만큼 옮긴 좌표계에서). */
function drawColumn(
  page: PDFPage,
  fonts: Fonts,
  record: PdfVisitRecord,
  index: number,
): void {
  page.pushOperators(
    pushGraphicsState(),
    translate(COLUMN_LEFTS[index] - COLUMN_LEFTS[0], 0),
  );
  drawTexts(page, fonts, columnTexts(recordTexts(record)));
  for (const [key, slot] of Object.entries(NURSE_COLUMN_FIELDS)) {
    drawField(page, fonts, key, slot, record.data);
  }
  drawColumnValues(page, fonts, record);
  page.pushOperators(popGraphicsState());
}

/**
 * 제7호 한 장(방문 최대 5건). records 는 같은 수급자·같은 달이고 날짜순이다.
 * last 는 향후계획·총평을 가져올 방문(그 달 마지막 방문).
 */
async function addNursePage(
  doc: PDFDocument,
  fonts: Fonts,
  records: readonly PdfVisitRecord[],
  last: PdfVisitRecord,
  footer: string,
): Promise<void> {
  const page = await addTemplatePage(doc, "HOME_CARE_NURSE");
  for (const box of HOME_CARE_COVER) cover(page, box);

  const t = recordTexts(records[0]);
  drawTexts(page, fonts, [
    ...basicInfo(
      t,
      { left: [231, 331], right: [436, 536] },
      [147.3, 164.8, 182.2, 199.7, 217.2],
    ),
    {
      text: t.date.year.slice(2),
      box: rect(118, 254.1, 130, 272),
      align: "center",
      size: 8,
    },
    {
      text: t.date.month,
      box: rect(144.5, 254.1, 153.5, 272),
      align: "center",
      size: 7,
    },
  ]);

  // 방문사유: 칸에 쓴 방문의 값을 모두 표시한다(정기·추가가 섞인 달이면 둘 다).
  const visitTypes = new Map(
    records.flatMap((record) =>
      selectedOptions(record.data, "visitType").map((option) => [
        option.value,
        option,
      ]),
    ),
  );
  drawField(page, fonts, "visitType", NURSE_PAGE_FIELDS.visitType, {
    visitType: [...visitTypes.values()],
  });

  records.forEach((record, index) => drawColumn(page, fonts, record, index));

  drawField(page, fonts, "plan", NURSE_PAGE_FIELDS.plan, last.data);
  drawField(page, fonts, "summary", NURSE_PAGE_FIELDS.summary, last.data);
  drawFooter(page, fonts, HOME_CARE_FOOTER, footer);
}

/** 방문 한 건(첫 칸만). */
export function addNurseVisitPage(
  doc: PDFDocument,
  fonts: Fonts,
  record: PdfVisitRecord,
): Promise<void> {
  return addNursePage(doc, fonts, [record], record, footerText(record));
}

/** 수급자 한 명의 한 달(확정 방문, 날짜순). 5건씩 한 장. */
export async function addNurseMonthPages(
  doc: PDFDocument,
  fonts: Fonts,
  records: readonly PdfVisitRecord[],
  footer: string,
): Promise<void> {
  const last = records.at(-1)!;
  for (let start = 0; start < records.length; start += VISITS_PER_PAGE) {
    await addNursePage(
      doc,
      fonts,
      records.slice(start, start + VISITS_PER_PAGE),
      last,
      footer,
    );
  }
}
