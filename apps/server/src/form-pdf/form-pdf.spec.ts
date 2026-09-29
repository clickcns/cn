import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FORMS,
  FORMS_WITH_ORIGINAL_PDF,
  formFields,
  type FormId,
  type OriginalPdfFormId,
} from "@repo/shared-types";
import { PDFDocument } from "pdf-lib";
import { buildNurseMonthPdf, buildVisitPdf } from "./build.js";
import {
  NURSE_COLUMN_FIELDS,
  NURSE_DRAWN_FIELDS,
  NURSE_PAGE_FIELDS,
} from "./overlay/home-care-nurse.js";
import type { FieldSlot } from "./overlay/layout.js";
import {
  HOME_CARE_DOCTOR_LAYOUT,
  HOME_CARE_SOCIAL_LAYOUT,
  PRIMARY_CARE_CHECK_LAYOUT,
} from "./overlay/layouts.js";
import { sampleRecord } from "./testing/sample-records.js";

/** 서식 정의의 칸·선택지 중 원본 자리가 없는 것(비어 있어야 한다). */
function missingSlots(
  formId: FormId,
  slots: Record<string, FieldSlot>,
  drawnByCode: readonly string[] = [],
): string[] {
  const missing: string[] = [];
  for (const field of formFields(FORMS[formId])) {
    if (drawnByCode.includes(field.key)) continue;
    const slot = slots[field.key];
    if (!slot) {
      missing.push(field.key);
      continue;
    }
    if (field.type === "single" || field.type === "multi") {
      if (slot.kind !== "options") {
        missing.push(`${field.key}(선택지 칸이 아님)`);
        continue;
      }
      for (const option of field.options) {
        const place = slot.options[option.value];
        if (!place) missing.push(`${field.key}.${option.value}`);
        else if (option.detail && !place.detail && !place.detailChoices) {
          missing.push(`${field.key}.${option.value}(괄호)`);
        }
      }
    }
  }
  return missing;
}

async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

/** 원본 서식마다 칸 자리(제7호는 방문 칸 + 장마다 한 번 그리는 칸). */
const ORIGINAL_SLOTS: Record<OriginalPdfFormId, Record<string, FieldSlot>> = {
  PRIMARY_CARE_CHECK: PRIMARY_CARE_CHECK_LAYOUT.fields,
  HOME_CARE_DOCTOR: HOME_CARE_DOCTOR_LAYOUT.fields,
  HOME_CARE_NURSE: { ...NURSE_COLUMN_FIELDS, ...NURSE_PAGE_FIELDS },
  HOME_CARE_SOCIAL: HOME_CARE_SOCIAL_LAYOUT.fields,
};

describe("원본 서식 자리", () => {
  it("원본 위에 채우는 서식은 서식 정의의 모든 칸·선택지에 자리가 있다", () => {
    for (const formId of FORMS_WITH_ORIGINAL_PDF) {
      assert.deepEqual(
        missingSlots(
          formId,
          ORIGINAL_SLOTS[formId],
          formId === "HOME_CARE_NURSE" ? NURSE_DRAWN_FIELDS : [],
        ),
        [],
        formId,
      );
    }
  });
});

describe("서식 PDF 만들기", () => {
  it("원본 서식은 서식마다 한 장, 원본이 없는 서식(제14호)은 표준 서식으로 그린다", async () => {
    const doctor = await buildVisitPdf(
      [sampleRecord("PRIMARY_CARE_CHECK"), sampleRecord("HOME_CARE_DOCTOR")],
      "original",
      "테스트",
    );
    assert.equal(await pageCount(doctor), 2);
    const nursing = await buildVisitPdf(
      [sampleRecord("LTC_NURSING")],
      "original",
      "테스트",
    );
    assert.equal(await pageCount(nursing), 1);
  });

  it("글꼴은 쓴 글자만 넣는다(표준 서식 한 장이 100KB를 넘지 않는다)", async () => {
    const bytes = await buildVisitPdf(
      [sampleRecord("HOME_CARE_SOCIAL")],
      "standard",
      "테스트",
    );
    assert.ok(bytes.length < 100_000, `${bytes.length} bytes`);
  });

  it("제7호 월간 기록지는 방문 5건씩 한 장이다", async () => {
    const records = Array.from({ length: 7 }, (_, i) =>
      sampleRecord("HOME_CARE_NURSE", {
        visitDate: `2026-09-${String(i + 1).padStart(2, "0")}`,
      }),
    );
    assert.equal(
      await pageCount(await buildNurseMonthPdf(records, "테스트", "출력")),
      2,
    );
  });
});
