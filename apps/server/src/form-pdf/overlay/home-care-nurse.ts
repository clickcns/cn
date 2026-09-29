import { roundPt, type FormData } from "@repo/shared-types";
import {
  popGraphicsState,
  pushGraphicsState,
  translate,
  type PDFDocument,
  type PDFPage,
} from "pdf-lib";
import { cover, type Fonts, type Point } from "../pdf-draw.js";
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
  type ItemId,
  type Placement,
  type TextSlot,
} from "./layout.js";
import {
  addTemplatePage,
  drawField,
  drawPlacedFooter,
  drawPlacedMark,
  drawTexts,
} from "./render.js";

/*
 * [별지 제7호] 장기요양 재택의료센터 방문점검 기록지(간호사). 원본은 한 장에 한 달 방문 5칸이고,
 * 방문사유 줄이 칸을 나눈다: "정기 방문"은 1~2번 칸, "추가 방문"은 3~5번 칸(지침의 기본 2회 +
 * 추가간호 3회). 방문은 방문사유에 따라 그 칸에 날짜순으로 채우고, 넘치면 다음 장에 적는다.
 * 향후계획·총평은 그 달 마지막 방문 값을 쓴다.
 */

/** 방문 칸 5개의 왼쪽 선(pt). 칸 너비는 약 72.6pt. 칸은 모두 첫 칸 좌표로 적고 옮겨 그린다. */
const COLUMN_LEFTS = [175.2, 247.8, 320.5, 393.0, 465.7] as const;

/** 방문사유별 칸(0부터). 원본 방문사유 줄의 세로선(175.2·320.5)이 이렇게 나눈다. */
const VISIT_TYPE_COLUMNS = {
  REGULAR: [0, 1],
  ADDITIONAL: [2, 3, 4],
} as const;
type VisitType = keyof typeof VISIT_TYPE_COLUMNS;

/** 방문 칸 값의 글자 크기. 칸 폭이 약 69pt로 좁아 다른 칸(10pt)보다 작게 쓴다. */
const COLUMN_SIZE = 9;

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
      PRESSURE_ULCER: box(187.9, 541.6, rect(199.8, 535, 235.5, 548)),
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
    box: col(2, 568, 40, 581),
    align: "right",
    size: COLUMN_SIZE,
  },
  notes: {
    kind: "text",
    box: col(2.5, 677.5, 70, 696.5),
    multiline: true,
    size: COLUMN_SIZE,
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

/** 칸마다 가로로 옮기는 거리(pt). 첫 칸은 0. 조정 화면이 방문 칸 자리를 다섯 칸에 함께 그린다. */
export const NURSE_COLUMN_OFFSETS = COLUMN_LEFTS.map((left) =>
  roundPt(left - COLUMN_LEFTS[0]),
);

/** 머리(기관·수급자)와 방문 연·월. */
export const NURSE_HEADER_TEXTS: TextSlot[] = [
  ...basicInfo(
    { left: [231, 331], right: [436, 536] },
    [147.3, 164.8, 182.2, 199.7, 217.2],
  ),
  {
    id: "date.year",
    box: rect(118, 254.1, 130, 272),
    align: "center",
    size: 8,
    text: (t) => t.date.year.slice(2),
  },
  {
    id: "date.month",
    box: rect(147.3, 254.1, 153.8, 272),
    align: "center",
    size: 7,
    text: (t) => t.date.month,
  },
];

/** 두 숫자 칸 중 하나라도 있으면 format 으로, 둘 다 없으면 빈 글. */
const eitherNumber =
  (a: string, b: string, format: (a: string, b: string) => string) =>
  (_t: RecordTexts, data: FormData) => {
    const [x, y] = [numberValue(data, a), numberValue(data, b)];
    return x === null && y === null ? "" : format(`${x ?? ""}`, `${y ?? ""}`);
  };

/**
 * 방문 칸 하나에 글로 쓰는 값(첫 칸 좌표): 날짜·간호사·시각, 혈압 짝·체온/혈당·체중 변화.
 * 글자 크기는 모두 COLUMN_SIZE.
 */
export const NURSE_COLUMN_TEXTS: TextSlot[] = (
  [
    {
      id: "col.day",
      box: col(2, 254.1, 56, 272),
      align: "right",
      text: (t) => t.date.day,
    },
    {
      id: "col.staffName",
      box: col(2, 272, 70.6, 289.5),
      align: "center",
      text: (t) => t.staffName,
    },
    {
      id: "col.licenseNumber",
      box: col(2, 289.5, 70.6, 307),
      align: "center",
      text: (t) => t.licenseNumber,
    },
    {
      id: "col.start.hour",
      box: col(4, 307, 34.5, 324.1),
      align: "right",
      text: (t) => t.start.hour,
    },
    {
      id: "col.start.minute",
      box: col(38.5, 307, 70, 324.1),
      text: (t) => t.start.minute,
    },
    {
      id: "col.end.hour",
      box: col(4, 324.1, 34.5, 341.3),
      align: "right",
      text: (t) => t.end.hour,
    },
    {
      id: "col.end.minute",
      box: col(38.5, 324.1, 70, 341.3),
      text: (t) => t.end.minute,
    },
    {
      id: "col.bloodPressure",
      box: col(2, 552.5, 32.5, 566.5),
      align: "right",
      fields: ["systolic", "diastolic"],
      text: eitherNumber("systolic", "diastolic", (a, b) => `${a}/${b}`),
    },
    {
      id: "col.tempGlucose",
      box: col(2, 581.5, 70.6, 599.8),
      align: "center",
      fields: ["temperature", "glucose"],
      text: eitherNumber(
        "temperature",
        "glucose",
        (a, b) => `${a}℃ / ${b}mg/dL`,
      ),
    },
    {
      id: "col.weight",
      box: col(30, 600.5, 57, 617.5),
      align: "right",
      fields: ["weightChange"],
      text: (_t, data) => {
        const weight = numberValue(data, "weightChange");
        return weight === null ? "" : String(Math.abs(weight));
      },
    },
  ] satisfies Omit<TextSlot, "size">[]
).map((slot) => ({ ...slot, size: COLUMN_SIZE }));

/** 체중 변화 "증/감" 글자에 두르는 동그라미 가운데(첫 칸 좌표). */
export const WEIGHT_RINGS = {
  "col.weight.up": { x: COLUMN_LEFTS[0] + 16.4, y: 608.9 },
  "col.weight.down": { x: COLUMN_LEFTS[0] + 28.3, y: 608.9 },
} as const satisfies Partial<Record<ItemId, Point>>;

/** 방문 한 건을 index 번째 칸에 그린다(첫 칸 좌표를 칸 간격만큼 옮긴 좌표계에서). */
function drawColumn(
  page: PDFPage,
  fonts: Fonts,
  record: PdfVisitRecord,
  index: number,
  place: Placement,
): void {
  page.pushOperators(
    pushGraphicsState(),
    translate(NURSE_COLUMN_OFFSETS[index], 0),
  );
  const { data } = record;
  // 원본은 "℃/ mg/㎗" 사이가 좁아 숫자를 넣을 수 없다. 값이 있으면 칸을 지우고 다시 쓴다.
  if (
    numberValue(data, "temperature") !== null ||
    numberValue(data, "glucose") !== null
  ) {
    cover(page, col(1.5, 583.2, 71.2, 598.6));
  }
  drawTexts(page, fonts, NURSE_COLUMN_TEXTS, recordTexts(record), data, place);
  for (const [key, slot] of Object.entries(NURSE_COLUMN_FIELDS)) {
    drawField(page, fonts, key, slot, data, place);
  }
  const weight = numberValue(data, "weightChange");
  if (weight !== null && weight !== 0) {
    const id = weight > 0 ? "col.weight.up" : "col.weight.down";
    drawPlacedMark(page, place, id, WEIGHT_RINGS[id], "ring");
  }
  page.pushOperators(popGraphicsState());
}

/** 방문사유. 필수가 되기 전에 확정해 비어 있는 방문은 정기로 본다. */
function visitTypeOf(record: PdfVisitRecord): VisitType {
  return selectedOptions(record.data, "visitType")[0]?.value === "ADDITIONAL"
    ? "ADDITIONAL"
    : "REGULAR";
}

export interface NurseColumn {
  /** 칸(0~4) */
  column: number;
  record: PdfVisitRecord;
}

/**
 * 방문(날짜순)을 장과 칸에 나눈다. 정기는 장마다 1~2번 칸, 추가는 3~5번 칸에 날짜순으로 채우고,
 * 어느 한쪽이 넘치면 다음 장으로 이어 간다.
 */
export function planNursePages(
  records: readonly PdfVisitRecord[],
): NurseColumn[][] {
  const groups = (Object.keys(VISIT_TYPE_COLUMNS) as VisitType[]).map(
    (type) => ({
      columns: VISIT_TYPE_COLUMNS[type],
      records: records.filter((record) => visitTypeOf(record) === type),
    }),
  );
  const pageCount = Math.max(
    1,
    ...groups.map((g) => Math.ceil(g.records.length / g.columns.length)),
  );
  return Array.from({ length: pageCount }, (_, page) =>
    groups.flatMap(({ columns, records: group }) =>
      group
        .slice(page * columns.length, (page + 1) * columns.length)
        .map((record, i) => ({ column: columns[i], record })),
    ),
  );
}

/**
 * 제7호 한 장. columns 는 같은 수급자·같은 달의 방문이다.
 * last 는 향후계획·총평을 가져올 방문(그 달 마지막 방문).
 */
async function addNursePage(
  doc: PDFDocument,
  fonts: Fonts,
  columns: readonly NurseColumn[],
  last: PdfVisitRecord,
  footer: string,
  place: Placement,
): Promise<void> {
  const page = await addTemplatePage(doc, "HOME_CARE_NURSE");
  for (const box of HOME_CARE_COVER) cover(page, box);

  const first = columns[0]?.record ?? last;
  drawTexts(
    page,
    fonts,
    NURSE_HEADER_TEXTS,
    recordTexts(first),
    first.data,
    place,
  );

  // 방문사유: 이 장에 방문이 있는 쪽(정기·추가)에 표시한다.
  const types = new Set(columns.map(({ record }) => visitTypeOf(record)));
  drawField(
    page,
    fonts,
    "visitType",
    NURSE_PAGE_FIELDS.visitType,
    { visitType: [...types].map((value) => ({ value })) },
    place,
  );

  for (const { column, record } of columns) {
    drawColumn(page, fonts, record, column, place);
  }

  drawField(page, fonts, "plan", NURSE_PAGE_FIELDS.plan, last.data, place);
  drawField(
    page,
    fonts,
    "summary",
    NURSE_PAGE_FIELDS.summary,
    last.data,
    place,
  );
  drawPlacedFooter(page, fonts, HOME_CARE_FOOTER, footer, place);
}

/** 방문 한 건(정기면 1번 칸, 추가면 3번 칸). */
export function addNurseVisitPage(
  doc: PDFDocument,
  fonts: Fonts,
  record: PdfVisitRecord,
  place: Placement,
): Promise<void> {
  const [columns] = planNursePages([record]);
  return addNursePage(doc, fonts, columns, record, footerText(record), place);
}

/** 수급자 한 명의 한 달(확정 방문, 날짜순). */
export async function addNurseMonthPages(
  doc: PDFDocument,
  fonts: Fonts,
  records: readonly PdfVisitRecord[],
  footer: string,
  place: Placement,
): Promise<void> {
  const last = records.at(-1)!;
  for (const columns of planNursePages(records)) {
    await addNursePage(doc, fonts, columns, last, footer, place);
  }
}
