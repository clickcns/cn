import type { Point, Rect } from "../pdf-draw.js";
import type { RecordTexts } from "../pdf-record.js";

/*
 * 원본 서식 PDF 위에 값을 얹는 자리(좌상단 원점, pt). 좌표는 원본에서 뽑았다:
 * 글자층이 있는 PDF는 scripts/form-pdf-coords.py 로 □/○·글자 위치를, 윤곽선 글자 PDF(제4호)는
 * 도형 크기로 □(6.8pt 선)·○(7.6pt 곡선)를 찾았다. 서식 정의의 모든 칸·선택지에 자리가 있는지는
 * form-pdf.spec.ts 가 확인한다(서식 정의가 바뀌면 여기서 걸린다).
 */

export interface OptionSlot {
  /** □·○ 가운데 */
  at: Point;
  shape: "box" | "circle";
  /** 괄호 안 내용(글)을 쓸 자리 */
  detail?: Rect;
  /** 괄호 안이 고르는 항목일 때(○ 정보제공 ○ 기관연계) 값별 ○ 가운데 */
  detailChoices?: Record<string, Point>;
}

export type FieldSlot =
  | { kind: "options"; options: Record<string, OptionSlot> }
  /** mark 가 있으면 값이 있을 때 그 □에 체크한다(제6호 "□ 내용(…)"). size 기본 8.5pt */
  | {
      kind: "text";
      box: Rect;
      multiline?: boolean;
      mark?: Point;
      size?: number;
    }
  /** size 기본 9pt */
  | {
      kind: "number";
      box: Rect;
      align?: "left" | "right" | "center";
      size?: number;
    };

/** 서식 값이 아닌 칸(머리·날짜·시각)에 쓸 글. */
export interface TextItem {
  text: string;
  box: Rect;
  align?: "left" | "center" | "right";
  size?: number;
}

export interface OverlayLayout {
  /** 흰색으로 덮을 곳(원본의 쪽 번호·내려받기 표시, 다시 쓸 칸) */
  cover: Rect[];
  /** 서식 칸 키 → 자리 */
  fields: Record<string, FieldSlot>;
  /** 머리·날짜·시각 */
  texts: (t: RecordTexts) => TextItem[];
  /** 출력 표시를 쓸 자리 */
  footer: Rect;
}

/** 칸 사이 간격을 줄여 적는 도우미: 좌표 두 개로 Rect. */
export function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x0, y0, x1, y1 };
}

export const box = (x: number, y: number, detail?: Rect): OptionSlot => ({
  at: { x, y },
  shape: "box",
  detail,
});

export const circle = (x: number, y: number, detail?: Rect): OptionSlot => ({
  at: { x, y },
  shape: "circle",
  detail,
});

/** 재택의료센터 서식(제6~8호) 공통: 원본의 쪽 번호를 덮는 곳과 출력 표시 자리. */
export const HOME_CARE_COVER = [rect(270, 798, 325, 815)];
export const HOME_CARE_FOOTER = rect(59, 818, 460, 828);

/** 재택의료센터 서식(제6~8호) 공통: 1. 기본 사항(기관·수급자) 칸. 칸 모양이 같고 위치만 다르다. */
export function basicInfo(
  t: RecordTexts,
  cols: { left: [number, number]; right: [number, number] },
  rows: [number, number, number, number, number],
): TextItem[] {
  const [l0, l1] = cols.left;
  const [r0, r1] = cols.right;
  const [y0, y1, y2, y3, y4] = rows;
  return [
    { text: t.orgName, box: rect(l0, y0, l1, y1) },
    { text: t.orgCode, box: rect(r0, y0, r1, y1) },
    { text: t.recipientName, box: rect(l0, y1, l1, y2) },
    { text: t.birthDate, box: rect(r0, y1, r1, y2) },
    { text: t.careGrade, box: rect(l0, y2, l1, y3) },
    { text: t.ltcCertNumber, box: rect(r0, y2, r1, y3) },
    { text: t.address, box: rect(l0, y3, r1, y4) },
  ];
}
