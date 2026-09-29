import { z } from "zod";
import type { OriginalPdfFormId } from "./form-pdf.js";
import { isoDateTime } from "./schema.js";

/*
 * 원본 서식 PDF 칸 미세조정. 운영자가 서식마다 한 벌 저장하고 모든 기관의 원본 서식 PDF에 적용한다.
 * 조정은 코드의 기본 자리에 더하는 값이라, 기본 좌표를 고쳐도 조정은 그 위에 그대로 얹힌다.
 * 좌표는 pt, 좌상단 원점(서식 PDF 그리기와 같다). 서버 그리기와 관리 웹 편집 화면이 아래 함수를 함께 쓴다.
 */

export const LAYOUT_ALIGNS = ["left", "center", "right"] as const;
export type LayoutAlign = (typeof LAYOUT_ALIGNS)[number];
export const LAYOUT_ALIGN_LABELS: Record<LayoutAlign, string> = {
  left: "왼쪽",
  center: "가운데",
  right: "오른쪽",
};

/** 좌상단(x0, y0) ~ 우하단(x1, y1), pt */
export interface LayoutRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutTextStyle {
  /** 글자 크기(pt). 칸보다 길면 그릴 때 더 줄인다. */
  size: number;
  bold: boolean;
  align: LayoutAlign;
}

/** 조정 한도(pt): 옮기기 ±200, 칸 넓히기 ±300, 글자 크기 4~24. */
export const LAYOUT_LIMITS = {
  offset: 200,
  resize: 300,
  size: { min: 4, max: 24 },
} as const;

const offset = z.number().min(-LAYOUT_LIMITS.offset).max(LAYOUT_LIMITS.offset);
const resize = z.number().min(-LAYOUT_LIMITS.resize).max(LAYOUT_LIMITS.resize);

/** 칸 하나의 조정. 옮기기(dx·dy), 칸 넓히기(dw·dh, 오른쪽·아래로), 글자 모양. */
export const LayoutItemAdjustmentSchema = z
  .object({
    dx: offset.optional(),
    dy: offset.optional(),
    dw: resize.optional(),
    dh: resize.optional(),
    size: z
      .number()
      .min(LAYOUT_LIMITS.size.min)
      .max(LAYOUT_LIMITS.size.max)
      .optional(),
    bold: z.boolean().optional(),
    align: z.enum(LAYOUT_ALIGNS).optional(),
  })
  .strict();
export type LayoutItemAdjustment = z.infer<typeof LayoutItemAdjustmentSchema>;

export const FormLayoutAdjustmentsSchema = z
  .object({
    /** 채운 값 전체를 한꺼번에 옮긴다(원본 인쇄 글자는 그대로). */
    page: z.object({ dx: offset, dy: offset }).strict().optional(),
    /** 칸 ID → 조정 */
    items: z.record(z.string().min(1).max(120), LayoutItemAdjustmentSchema),
  })
  .strict();
export type FormLayoutAdjustments = z.infer<typeof FormLayoutAdjustmentsSchema>;

export const EMPTY_LAYOUT_ADJUSTMENTS: FormLayoutAdjustments = { items: {} };

/** PUT /form-layouts/:formId */
export const SaveFormLayoutSchema = z.object({
  adjustments: FormLayoutAdjustmentsSchema,
  /** 화면이 불러온 저장 시각(저장본이 없었으면 null). 그사이 다른 사람이 저장했으면 409 */
  expectedUpdatedAt: isoDateTime(
    "저장 시각 형식이 올바르지 않습니다",
  ).nullable(),
});
export type SaveFormLayoutInput = z.input<typeof SaveFormLayoutSchema>;

/** POST /form-layouts/:formId/preview — 저장하지 않은 조정으로 표본 PDF를 그린다. */
export const PreviewFormLayoutSchema = z.object({
  adjustments: FormLayoutAdjustmentsSchema,
});
export type PreviewFormLayoutInput = z.input<typeof PreviewFormLayoutSchema>;

interface FormLayoutItemBase {
  id: string;
  label: string;
  /** 편집 화면 목록의 묶음(서식 절 이름 등) */
  group: string;
  /** 제7호 방문 칸: 첫 칸 자리이고, 조정은 다섯 칸에 함께 적용된다 */
  repeated?: boolean;
  /** 이 칸이 그리는 서식 칸 키(칸 키와 ID가 다를 때만, 예: 혈압 짝 → systolic·diastolic) */
  fields?: readonly string[];
}

/** 조정할 수 있는 칸 하나(기본 자리). mark: □ 체크·○ 표시·동그라미, text: 한 줄 글, paragraph: 여러 줄 글 */
export type FormLayoutItem = FormLayoutItemBase &
  (
    | { kind: "mark"; point: LayoutPoint }
    | { kind: "text" | "paragraph"; rect: LayoutRect; style: LayoutTextStyle }
  );

interface LayoutActor {
  id: string;
  name: string;
}

export interface FormLayoutSummary {
  formId: OriginalPdfFormId;
  /** 조정한 칸 수(페이지 전체 옮기기 제외) */
  adjustedCount: number;
  updatedAt: string | null;
  updatedBy: LayoutActor | null;
}

export interface FormLayoutDetail extends FormLayoutSummary {
  page: { width: number; height: number };
  items: FormLayoutItem[];
  /** repeated 칸을 그리는 칸별 가로 이동(pt). 첫 칸은 0 */
  repeatOffsets: number[];
  adjustments: FormLayoutAdjustments;
}

/** 칸 조정 적용: 넓히기(최소 폭·높이 2pt) → 옮기기(칸 + 페이지 전체). */
export function adjustRect(
  rect: LayoutRect,
  adjustment?: LayoutItemAdjustment,
  page?: FormLayoutAdjustments["page"],
): LayoutRect {
  const dx = (adjustment?.dx ?? 0) + (page?.dx ?? 0);
  const dy = (adjustment?.dy ?? 0) + (page?.dy ?? 0);
  const x1 = Math.max(rect.x0 + 2, rect.x1 + (adjustment?.dw ?? 0));
  const y1 = Math.max(rect.y0 + 2, rect.y1 + (adjustment?.dh ?? 0));
  return { x0: rect.x0 + dx, y0: rect.y0 + dy, x1: x1 + dx, y1: y1 + dy };
}

export function adjustPoint(
  point: LayoutPoint,
  adjustment?: LayoutItemAdjustment,
  page?: FormLayoutAdjustments["page"],
): LayoutPoint {
  return {
    x: point.x + (adjustment?.dx ?? 0) + (page?.dx ?? 0),
    y: point.y + (adjustment?.dy ?? 0) + (page?.dy ?? 0),
  };
}

export function adjustStyle(
  style: LayoutTextStyle,
  adjustment?: LayoutItemAdjustment,
): LayoutTextStyle {
  return {
    size: adjustment?.size ?? style.size,
    bold: adjustment?.bold ?? style.bold,
    align: adjustment?.align ?? style.align,
  };
}

/** 조정 값의 정밀도(0.1pt)로 반올림한다. */
export const roundPt = (value: number) => Math.round(value * 10) / 10;

/**
 * 저장할 모양으로 정리한다: 0.1pt로 반올림하고, 바뀐 것이 없는 값·칸은 빼고, 칸 ID 순으로 늘어놓는다
 * (DB의 JSON은 키 순서를 바꾸므로, 같은 조정이 늘 같은 글이 되어야 비교·캐시가 맞다).
 */
export function cleanLayoutAdjustments(
  adjustments: FormLayoutAdjustments,
): FormLayoutAdjustments {
  const items: FormLayoutAdjustments["items"] = {};
  const entries = Object.entries(adjustments.items).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const [id, adjustment] of entries) {
    const clean: LayoutItemAdjustment = {};
    for (const key of ["dx", "dy", "dw", "dh"] as const) {
      const value = roundPt(adjustment[key] ?? 0);
      if (value !== 0) clean[key] = value;
    }
    if (adjustment.size !== undefined) clean.size = roundPt(adjustment.size);
    if (adjustment.bold !== undefined) clean.bold = adjustment.bold;
    if (adjustment.align !== undefined) clean.align = adjustment.align;
    if (Object.keys(clean).length > 0) items[id] = clean;
  }
  const page = adjustments.page && {
    dx: roundPt(adjustments.page.dx),
    dy: roundPt(adjustments.page.dy),
  };
  return page && (page.dx !== 0 || page.dy !== 0) ? { page, items } : { items };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 한도 안으로 맞춘다(편집 화면이 끌기·입력한 값을 저장할 수 있게). */
export function clampLayoutAdjustment(
  adjustment: LayoutItemAdjustment,
): LayoutItemAdjustment {
  const { offset: o, resize: r, size } = LAYOUT_LIMITS;
  const next = { ...adjustment };
  if (next.dx !== undefined) next.dx = clamp(next.dx, -o, o);
  if (next.dy !== undefined) next.dy = clamp(next.dy, -o, o);
  if (next.dw !== undefined) next.dw = clamp(next.dw, -r, r);
  if (next.dh !== undefined) next.dh = clamp(next.dh, -r, r);
  if (next.size !== undefined) next.size = clamp(next.size, size.min, size.max);
  return next;
}
