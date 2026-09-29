import {
  hasOriginalPdf,
  type FormPdfStyle,
  type OriginalPdfFormId,
} from "@repo/shared-types";
import type { PDFDocument } from "pdf-lib";
import { renderPdf, type Fonts } from "./pdf-draw.js";
import type { PdfVisitRecord } from "./pdf-record.js";
import type { OverlayLayout } from "./overlay/layout.js";
import {
  HOME_CARE_DOCTOR_LAYOUT,
  HOME_CARE_SOCIAL_LAYOUT,
  PRIMARY_CARE_CHECK_LAYOUT,
} from "./overlay/layouts.js";
import {
  addNurseMonthPages,
  addNurseVisitPage,
} from "./overlay/home-care-nurse.js";
import { addOverlayPage } from "./overlay/render.js";
import { addStandardPages } from "./standard/render.js";

type AddPage = (
  doc: PDFDocument,
  fonts: Fonts,
  record: PdfVisitRecord,
) => Promise<void>;

const overlay =
  (layout: OverlayLayout): AddPage =>
  (doc, fonts, record) =>
    addOverlayPage(doc, fonts, layout, record);

/**
 * 원본 서식 위에 채우는 서식. 키는 shared-types 의 FORMS_WITH_ORIGINAL_PDF 와 같아야 한다(타입이
 * 강제한다). 제7호는 방문 칸 구조라 따로 그린다.
 */
const ORIGINAL_PAGES: Record<OriginalPdfFormId, AddPage> = {
  PRIMARY_CARE_CHECK: overlay(PRIMARY_CARE_CHECK_LAYOUT),
  HOME_CARE_DOCTOR: overlay(HOME_CARE_DOCTOR_LAYOUT),
  HOME_CARE_NURSE: addNurseVisitPage,
  HOME_CARE_SOCIAL: overlay(HOME_CARE_SOCIAL_LAYOUT),
};

/**
 * 방문 한 건(확정본 한 벌)의 서식들을 서식 순서대로 한 PDF에 담는다.
 * original: 원본 서식이 있으면 원본 위에 채우고 없으면 표준 서식. standard: 모두 표준 서식.
 */
export function buildVisitPdf(
  records: readonly PdfVisitRecord[],
  style: FormPdfStyle,
  title: string,
): Promise<Uint8Array> {
  return renderPdf(title, async (doc, fonts) => {
    for (const record of records) {
      if (style === "original" && hasOriginalPdf(record.formId)) {
        await ORIGINAL_PAGES[record.formId](doc, fonts, record);
      } else {
        addStandardPages(doc, fonts, record);
      }
    }
  });
}

/** 제7호 월간 기록지: 같은 수급자·같은 달 확정 방문(날짜순)을 칸에 채운다. */
export function buildNurseMonthPdf(
  records: readonly PdfVisitRecord[],
  title: string,
  footer: string,
): Promise<Uint8Array> {
  return renderPdf(title, (doc, fonts) =>
    addNurseMonthPages(doc, fonts, records, footer),
  );
}
