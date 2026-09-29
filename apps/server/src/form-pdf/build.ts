import {
  hasOriginalPdf,
  type FormId,
  type FormLayoutAdjustments,
  type FormPdfStyle,
  type OriginalPdfFormId,
} from "@repo/shared-types";
import type { PDFDocument } from "pdf-lib";
import { renderPdf, type Fonts } from "./pdf-draw.js";
import type { PdfVisitRecord } from "./pdf-record.js";
import {
  placement,
  type OverlayLayout,
  type Placement,
} from "./overlay/layout.js";
import { OVERLAY_LAYOUTS } from "./overlay/layouts.js";
import {
  addNurseMonthPages,
  addNurseVisitPage,
} from "./overlay/home-care-nurse.js";
import { addOverlayPage } from "./overlay/render.js";
import { layoutPreviewRecords } from "./sample-records.js";
import { addStandardPages } from "./standard/render.js";

type AddPage = (
  doc: PDFDocument,
  fonts: Fonts,
  record: PdfVisitRecord,
  place: Placement,
) => Promise<void>;

const overlay =
  (layout: OverlayLayout): AddPage =>
  (doc, fonts, record, place) =>
    addOverlayPage(doc, fonts, layout, record, place);

/**
 * 원본 서식 위에 채우는 서식. 키는 shared-types 의 FORMS_WITH_ORIGINAL_PDF 와 같아야 한다(타입이
 * 강제한다). 제7호는 방문 칸 구조라 따로 그린다.
 */
const ORIGINAL_PAGES: Record<OriginalPdfFormId, AddPage> = {
  PRIMARY_CARE_CHECK: overlay(OVERLAY_LAYOUTS.PRIMARY_CARE_CHECK),
  HOME_CARE_DOCTOR: overlay(OVERLAY_LAYOUTS.HOME_CARE_DOCTOR),
  HOME_CARE_NURSE: addNurseVisitPage,
  HOME_CARE_SOCIAL: overlay(OVERLAY_LAYOUTS.HOME_CARE_SOCIAL),
};

/** 서식별 운영자 조정(원본 서식 조정 화면에서 저장한 값). 없는 서식은 기본 자리. */
export type LayoutAdjustmentsByForm = Partial<
  Record<FormId, FormLayoutAdjustments>
>;

/**
 * 방문 한 건(확정본 한 벌)의 서식들을 서식 순서대로 한 PDF에 담는다.
 * original: 원본 서식이 있으면 원본 위에 채우고 없으면 표준 서식. standard: 모두 표준 서식.
 */
export function buildVisitPdf(
  records: readonly PdfVisitRecord[],
  style: FormPdfStyle,
  title: string,
  adjustments: LayoutAdjustmentsByForm = {},
): Promise<Uint8Array> {
  return renderPdf(title, async (doc, fonts) => {
    for (const record of records) {
      if (style === "original" && hasOriginalPdf(record.formId)) {
        await ORIGINAL_PAGES[record.formId](
          doc,
          fonts,
          record,
          placement(adjustments[record.formId]),
        );
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
  adjustments: LayoutAdjustmentsByForm = {},
): Promise<Uint8Array> {
  return renderPdf(title, (doc, fonts) =>
    addNurseMonthPages(
      doc,
      fonts,
      records,
      footer,
      placement(adjustments.HOME_CARE_NURSE),
    ),
  );
}

/** 원본 서식 조정 화면의 미리보기: 표본(모든 칸·선택지를 채움)을 조정한 자리에 그린다. */
export function buildLayoutPreviewPdf(
  formId: OriginalPdfFormId,
  adjustments: FormLayoutAdjustments,
): Promise<Uint8Array> {
  const records = layoutPreviewRecords(formId);
  const byForm = { [formId]: adjustments };
  return formId === "HOME_CARE_NURSE"
    ? buildNurseMonthPdf(
        records,
        "원본 서식 조정",
        "케어노트 출력 · 표본",
        byForm,
      )
    : buildVisitPdf(records, "original", "원본 서식 조정", byForm);
}
