import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FormData, FormId } from "@repo/shared-types";
import { PDFDocument, type PDFPage } from "pdf-lib";
import {
  ASSETS_DIR,
  cover,
  drawCheck,
  drawDot,
  drawFooter,
  drawLine,
  drawParagraph,
  type Fonts,
} from "../pdf-draw.js";
import {
  footerText,
  numberValue,
  recordTexts,
  selectedOptions,
  textValue,
  type PdfVisitRecord,
} from "../pdf-record.js";
import type {
  FieldSlot,
  OptionSlot,
  OverlayLayout,
  TextItem,
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

/** 원본 서식 한 장을 문서 끝에 붙여 돌려준다. */
export async function addTemplatePage(
  doc: PDFDocument,
  formId: FormId,
): Promise<PDFPage> {
  const [page] = await doc.copyPages(await loadTemplate(formId), [0]);
  doc.addPage(page);
  return page;
}

export function drawTexts(
  page: PDFPage,
  fonts: Fonts,
  items: TextItem[],
): void {
  for (const item of items) {
    drawLine(page, item.text, item.box, {
      font: fonts.regular,
      size: item.size ?? 9,
      align: item.align,
    });
  }
}

/** 고른 항목에 표시하고 괄호 안 내용을 쓴다. */
function drawOption(
  page: PDFPage,
  fonts: Fonts,
  slot: OptionSlot,
  detail: string | null | undefined,
): void {
  if (slot.shape === "box") drawCheck(page, slot.at);
  else drawDot(page, slot.at);
  if (!detail) return;
  if (slot.detailChoices) {
    const choice = slot.detailChoices[detail];
    if (choice) drawDot(page, choice);
    return;
  }
  if (slot.detail) {
    drawLine(page, detail, slot.detail, { font: fonts.regular, size: 8 });
  }
}

/** 서식 값 한 칸을 그린다. */
export function drawField(
  page: PDFPage,
  fonts: Fonts,
  key: string,
  slot: FieldSlot,
  data: FormData,
): void {
  switch (slot.kind) {
    case "options":
      for (const selected of selectedOptions(data, key)) {
        const option = slot.options[selected.value];
        if (option) drawOption(page, fonts, option, selected.detail);
      }
      return;
    case "text": {
      const text = textValue(data, key);
      if (!text) return;
      if (slot.mark) drawCheck(page, slot.mark);
      const options = { font: fonts.regular, size: slot.size ?? 8.5 };
      if (slot.multiline) drawParagraph(page, text, slot.box, options);
      else drawLine(page, text, slot.box, options);
      return;
    }
    case "number": {
      const value = numberValue(data, key);
      if (value === null) return;
      drawLine(page, String(value), slot.box, {
        font: fonts.regular,
        size: slot.size ?? 9,
        align: slot.align,
      });
      return;
    }
  }
}

/** 방문 한 건의 서식 한 장을 원본 위에 채워 붙인다. */
export async function addOverlayPage(
  doc: PDFDocument,
  fonts: Fonts,
  layout: OverlayLayout,
  record: PdfVisitRecord,
): Promise<void> {
  const page = await addTemplatePage(doc, record.formId);
  for (const box of layout.cover) cover(page, box);
  drawTexts(page, fonts, layout.texts(recordTexts(record)));
  for (const [key, slot] of Object.entries(layout.fields)) {
    drawField(page, fonts, key, slot, record.data);
  }
  drawFooter(page, fonts, layout.footer, footerText(record));
}
