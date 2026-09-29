import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FormData, FormId, LayoutTextStyle } from "@repo/shared-types";
import { PDFDocument, type PDFPage } from "pdf-lib";
import {
  ASSETS_DIR,
  cover,
  drawCheck,
  drawDot,
  drawLine,
  drawParagraph,
  fontOf,
  GRAY,
  type Fonts,
  type Rect,
  type TextOptions,
} from "../pdf-draw.js";
import {
  footerText,
  numberValue,
  recordTexts,
  selectedOptions,
  textValue,
  type PdfVisitRecord,
  type RecordTexts,
} from "../pdf-record.js";
import {
  DETAIL_STYLE,
  fieldSlotStyle,
  FOOTER_STYLE,
  slotId,
  textSlotStyle,
  type FieldSlot,
  type OptionSlot,
  type OverlayLayout,
  type Placement,
  type TextSlot,
} from "./layout.js";

const templates = new Map<FormId, Promise<PDFDocument>>();

/** 원본 서식 PDF(assets/templates/<서식ID>.pdf). 한 번 읽어 두고 페이지를 복사해 쓴다. */
function loadTemplate(formId: FormId): Promise<PDFDocument> {
  let template = templates.get(formId);
  if (!template) {
    template = readFile(join(ASSETS_DIR, "templates", `${formId}.pdf`)).then(
      (bytes) => PDFDocument.load(bytes),
    );
    templates.set(formId, template);
  }
  return template;
}

/** 원본 서식의 쪽 크기(pt). */
export async function templatePageSize(
  formId: FormId,
): Promise<{ width: number; height: number }> {
  return (await loadTemplate(formId)).getPage(0).getSize();
}

/** 원본 서식 한 장을 문서 끝에 붙여 돌려준다. */
export async function addTemplatePage(
  doc: PDFDocument,
  formId: FormId,
): Promise<PDFPage> {
  const [page] = await doc.copyPages(await loadTemplate(formId), [0]);
  doc.addPage(page);
  return page;
}

/**
 * id 자리에 운영자 조정(자리·글자 크기·굵기·정렬)을 반영해 한 줄을 쓴다(빈 글이면 그리지 않는다).
 */
function drawPlaced(
  page: PDFPage,
  fonts: Fonts,
  place: Placement,
  id: string,
  text: string,
  box: Rect,
  base: LayoutTextStyle,
  color?: TextOptions["color"],
): void {
  const style = place.style(id, base);
  drawLine(page, text, place.rect(id, box), {
    font: fontOf(fonts, style.bold),
    size: style.size,
    align: style.align,
    color,
  });
}

/** 서식 값이 아닌 칸(머리·날짜·시각·방문 칸 값)을 기록에서 채운다. */
export function drawTexts(
  page: PDFPage,
  fonts: Fonts,
  slots: readonly TextSlot[],
  t: RecordTexts,
  data: FormData,
  place: Placement,
): void {
  for (const slot of slots) {
    drawPlaced(
      page,
      fonts,
      place,
      slot.id,
      slot.text(t, data),
      slot.box,
      textSlotStyle(slot),
    );
  }
}

/** 고른 항목에 표시하고 괄호 안 내용을 쓴다. */
function drawOption(
  page: PDFPage,
  fonts: Fonts,
  id: string,
  slot: OptionSlot,
  detail: string | null | undefined,
  place: Placement,
): void {
  const at = place.point(id, slot.at);
  if (slot.shape === "box") drawCheck(page, at);
  else drawDot(page, at);
  if (!detail) return;
  if (slot.detailChoices) {
    const choice = slot.detailChoices[detail];
    if (choice) drawDot(page, place.point(slotId.choice(id, detail), choice));
    return;
  }
  if (slot.detail) {
    drawPlaced(
      page,
      fonts,
      place,
      slotId.detail(id),
      detail,
      slot.detail,
      DETAIL_STYLE,
    );
  }
}

/** 서식 값 한 칸을 그린다. */
export function drawField(
  page: PDFPage,
  fonts: Fonts,
  key: string,
  slot: FieldSlot,
  data: FormData,
  place: Placement,
): void {
  switch (slot.kind) {
    case "options":
      for (const selected of selectedOptions(data, key)) {
        const option = slot.options[selected.value];
        if (option) {
          drawOption(
            page,
            fonts,
            slotId.option(key, selected.value),
            option,
            selected.detail,
            place,
          );
        }
      }
      return;
    case "text": {
      const text = textValue(data, key);
      if (!text) return;
      if (slot.mark) drawCheck(page, place.point(slotId.mark(key), slot.mark));
      if (!slot.multiline) {
        drawPlaced(
          page,
          fonts,
          place,
          key,
          text,
          slot.box,
          fieldSlotStyle(slot),
        );
        return;
      }
      const style = place.style(key, fieldSlotStyle(slot));
      drawParagraph(page, text, place.rect(key, slot.box), {
        font: fontOf(fonts, style.bold),
        size: style.size,
      });
      return;
    }
    case "number": {
      const value = numberValue(data, key);
      if (value === null) return;
      drawPlaced(
        page,
        fonts,
        place,
        key,
        String(value),
        slot.box,
        fieldSlotStyle(slot),
      );
      return;
    }
  }
}

/** 출력 표시(쪽 아래, 회색). */
export function drawPlacedFooter(
  page: PDFPage,
  fonts: Fonts,
  box: Rect,
  text: string,
  place: Placement,
): void {
  drawPlaced(page, fonts, place, "footer", text, box, FOOTER_STYLE, GRAY);
}

/** 방문 한 건의 서식 한 장을 원본 위에 채워 붙인다. */
export async function addOverlayPage(
  doc: PDFDocument,
  fonts: Fonts,
  layout: OverlayLayout,
  record: PdfVisitRecord,
  place: Placement,
): Promise<void> {
  const page = await addTemplatePage(doc, record.formId);
  for (const box of layout.cover) cover(page, box);
  drawTexts(page, fonts, layout.texts, recordTexts(record), record.data, place);
  for (const [key, slot] of Object.entries(layout.fields)) {
    drawField(page, fonts, key, slot, record.data, place);
  }
  drawPlacedFooter(page, fonts, layout.footer, footerText(record), place);
}
