import { z } from "zod";
import { isIsoMonth } from "./date.js";
import type { FormId } from "./forms/index.js";

/**
 * 서식 PDF 모양.
 * - original: 원본 서식(지침 부록 PDF)이 있으면 원본 위에 채우고, 없으면 표준 서식으로 그린다.
 * - standard: 서식 정의(항목·선택지)로 서식 모양을 그린다. 원본이 없거나 개정돼도 따로 손볼 것이 없다.
 */
export const FORM_PDF_STYLES = ["original", "standard"] as const;
export type FormPdfStyle = (typeof FORM_PDF_STYLES)[number];

/**
 * 원본 서식 위에 채울 수 있는 서식(원본 PDF와 칸 자리가 서버에 있다). 제14호는 원본을 받으면 더한다.
 * 서버의 원본 서식 목록(ORIGINAL_PAGES)이 이 타입의 키를 모두 가져야 해서 둘이 어긋나면 컴파일되지 않는다.
 */
export const FORMS_WITH_ORIGINAL_PDF = [
  "PRIMARY_CARE_CHECK",
  "HOME_CARE_DOCTOR",
  "HOME_CARE_NURSE",
  "HOME_CARE_SOCIAL",
] as const satisfies readonly FormId[];
export type OriginalPdfFormId = (typeof FORMS_WITH_ORIGINAL_PDF)[number];

export function hasOriginalPdf(formId: FormId): formId is OriginalPdfFormId {
  return (FORMS_WITH_ORIGINAL_PDF as readonly FormId[]).includes(formId);
}

/** GET /visits/:id/versions/:version/pdf */
export const FormPdfQuerySchema = z.object({
  style: z.enum(FORM_PDF_STYLES).default("original"),
});
export type FormPdfQuery = z.input<typeof FormPdfQuerySchema>;

/** GET /recipients/:id/home-care-nurse-pdf — 제7호 월간 기록지(원본 서식). */
export const NurseMonthPdfQuerySchema = z.object({
  month: z.string().refine(isIsoMonth, "달은 YYYY-MM 형식으로 보내 주세요"),
});
export type NurseMonthPdfQuery = z.input<typeof NurseMonthPdfQuerySchema>;
