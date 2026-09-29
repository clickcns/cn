import {
  adjustPoint,
  adjustRect,
  adjustStyle,
  type FormData,
  type FormLayoutAdjustments,
  type LayoutAlign,
  type LayoutTextStyle,
} from "@repo/shared-types";
import type { Point, Rect } from "../pdf-draw.js";
import type { RecordTexts } from "../pdf-record.js";

/*
 * 원본 서식 PDF 위에 값을 얹는 자리(좌상단 원점, pt). 좌표는 원본에서 뽑았다:
 * 글자층이 있는 PDF는 scripts/form-pdf-coords.py 로 □/○·글자 위치를, 윤곽선 글자 PDF(제4호)는
 * 도형 크기로 □(6.8pt 선)·○(7.6pt 곡선)를 찾았다. 서식 정의의 모든 칸·선택지에 자리가 있는지는
 * form-pdf.spec.ts 가 확인한다(서식 정의가 바뀌면 여기서 걸린다).
 *
 * 자리마다 ID가 있어 운영자가 원본 서식 조정 화면에서 옮기거나 글자 모양을 바꿀 수 있다(Placement).
 * 서식 칸의 ID는 slotId 가 만들고(그리기와 조정 화면 칸 목록이 함께 쓴다), 머리·날짜·시각·방문 칸
 * 값은 ITEM_LABELS 의 키다.
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
      align?: LayoutAlign;
      size?: number;
    };

/** 서식 칸 자리의 ID. 글·숫자 칸은 칸 키 그대로다. */
export const slotId = {
  /** 선택지 표시(□·○): "칸키.값" */
  option: (key: string, value: string) => `${key}.${value}`,
  /** 선택지 괄호 안 글: "칸키.값:detail" */
  detail: (optionId: string) => `${optionId}:detail`,
  /** 선택지 괄호 안 고르는 항목의 ○: "칸키.값:괄호값" */
  choice: (optionId: string, value: string) => `${optionId}:${value}`,
  /** 글 칸 앞 □: "칸키:mark" */
  mark: (key: string) => `${key}:mark`,
};

/** 서식 값이 아닌 칸(머리·날짜·시각, 제7호 방문 칸 값)과 조정 화면에 보이는 이름. */
export const ITEM_LABELS = {
  orgName: "의료기관명",
  orgCode: "의료기관기호",
  recipientName: "수급자 성명",
  birthDate: "생년월일",
  careGrade: "장기요양등급",
  ltcCertNumber: "장기요양인정번호",
  address: "주소",
  staffName: "담당자 성명",
  profession: "면허(자격) 종류",
  licenseNumber: "면허(자격)번호",
  "date.year": "방문일 · 년",
  "date.month": "방문일 · 월",
  "date.day": "방문일 · 일",
  "start.year": "시작 · 년",
  "start.month": "시작 · 월",
  "start.day": "시작 · 일",
  "start.hour": "시작 · 시",
  "start.minute": "시작 · 분",
  "end.year": "종료 · 년",
  "end.month": "종료 · 월",
  "end.day": "종료 · 일",
  "end.hour": "종료 · 시",
  "end.minute": "종료 · 분",
  "col.day": "방문 칸 · 일",
  "col.staffName": "방문 칸 · 간호사명",
  "col.licenseNumber": "방문 칸 · 면허번호",
  "col.start.hour": "방문 칸 · 시작 시",
  "col.start.minute": "방문 칸 · 시작 분",
  "col.end.hour": "방문 칸 · 종료 시",
  "col.end.minute": "방문 칸 · 종료 분",
  "col.bloodPressure": "방문 칸 · 혈압",
  "col.tempGlucose": "방문 칸 · 체온/혈당",
  "col.weight": "방문 칸 · 체중 변화(kg)",
  "col.weight.up": "방문 칸 · 체중 증 동그라미",
  "col.weight.down": "방문 칸 · 체중 감 동그라미",
  footer: "출력 표시(쪽 아래)",
} as const;
export type ItemId = keyof typeof ITEM_LABELS;

/**
 * 서식 값이 아닌 칸(머리·날짜·시각·방문 칸 값). 자리는 고정이고 글은 기록에서 꺼낸다(빈 글이면
 * 그리지 않는다). fields 는 이 칸이 그리는 서식 칸(칸 확인 테스트·조정 화면이 쓴다).
 */
export interface TextSlot {
  id: ItemId;
  box: Rect;
  text: (t: RecordTexts, data: FormData) => string;
  align?: LayoutAlign;
  size?: number;
  fields?: readonly string[];
}

export interface OverlayLayout {
  /** 흰색으로 덮을 곳(원본의 쪽 번호·내려받기 표시, 다시 쓸 칸). 조정하지 않는다. */
  cover: Rect[];
  /** 서식 칸 키 → 자리 */
  fields: Record<string, FieldSlot>;
  /** 머리·날짜·시각 */
  texts: TextSlot[];
  /** 출력 표시를 쓸 자리 */
  footer: Rect;
}

/** 자리의 기본 글자 모양. */
export const TEXT_STYLE = { size: 9, bold: false, align: "left" } as const;
export const DETAIL_STYLE = { size: 8, bold: false, align: "left" } as const;
export const FOOTER_STYLE = { size: 6.5, bold: false, align: "left" } as const;

export function textSlotStyle(slot: TextSlot): LayoutTextStyle {
  return {
    ...TEXT_STYLE,
    size: slot.size ?? TEXT_STYLE.size,
    align: slot.align ?? TEXT_STYLE.align,
  };
}

/** 글(8.5pt)·숫자(9pt) 칸의 기본 글자 모양. */
export function fieldSlotStyle(
  slot: Extract<FieldSlot, { kind: "text" | "number" }>,
): LayoutTextStyle {
  return slot.kind === "text"
    ? { ...TEXT_STYLE, size: slot.size ?? 8.5 }
    : {
        ...TEXT_STYLE,
        size: slot.size ?? TEXT_STYLE.size,
        align: slot.align ?? TEXT_STYLE.align,
      };
}

/** 운영자 조정을 적용한 자리·글자 모양. 조정이 없는 ID는 기본 그대로다. */
export interface Placement {
  rect(id: string, rect: Rect): Rect;
  point(id: string, point: Point): Point;
  style(id: string, style: LayoutTextStyle): LayoutTextStyle;
}

export function placement(adjustments?: FormLayoutAdjustments): Placement {
  const items = adjustments?.items ?? {};
  const page = adjustments?.page;
  return {
    rect: (id, value) => adjustRect(value, items[id], page),
    point: (id, value) => adjustPoint(value, items[id], page),
    style: (id, value) => adjustStyle(value, items[id]),
  };
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
  cols: { left: [number, number]; right: [number, number] },
  rows: [number, number, number, number, number],
): TextSlot[] {
  const [l0, l1] = cols.left;
  const [r0, r1] = cols.right;
  const [y0, y1, y2, y3, y4] = rows;
  return [
    { id: "orgName", box: rect(l0, y0, l1, y1), text: (t) => t.orgName },
    { id: "orgCode", box: rect(r0, y0, r1, y1), text: (t) => t.orgCode },
    {
      id: "recipientName",
      box: rect(l0, y1, l1, y2),
      text: (t) => t.recipientName,
    },
    { id: "birthDate", box: rect(r0, y1, r1, y2), text: (t) => t.birthDate },
    { id: "careGrade", box: rect(l0, y2, l1, y3), text: (t) => t.careGrade },
    {
      id: "ltcCertNumber",
      box: rect(r0, y2, r1, y3),
      text: (t) => t.ltcCertNumber,
    },
    { id: "address", box: rect(l0, y3, r1, y4), text: (t) => t.address },
  ];
}
