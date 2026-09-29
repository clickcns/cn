import {
  FORMS,
  formFields,
  type FieldDef,
  type FormData,
  type FormId,
  type OptionDetail,
  type VisitRecordHeader,
} from "@repo/shared-types";
import type { PdfVisitRecord } from "./pdf-record.js";

/*
 * 표본 기록(테스트·미리보기 스크립트·원본 서식 조정 화면). "full"은 여러 개 고르기의 모든 선택지를
 * 고르고 괄호·글 칸을 길게 채워 원본 칸 자리가 맞는지 한눈에 보게 한다.
 */

const SAMPLE_HEADER: VisitRecordHeader = {
  organization: { name: "데모 재택의료의원", code: "12345678" },
  recipient: {
    name: "강옥자",
    chartNumber: "2001",
    birthDate: "1939-03-02",
    gender: "FEMALE",
    careGrade: "1",
    ltcCertNumber: "L0000001101",
    address: "서울시 가상구 연습로 21, 3층",
  },
  staff: { name: "정의사", licenseNumber: "D-200001" },
};

const LONG_TEXT =
  "욕창 2단계 유지. 도뇨관 교체 후 소변 배출 양호함. 보호자에게 체위 변경을 2시간마다 하도록 다시 안내했고, 다음 방문 때 드레싱 상태를 확인한다.";

function fullValue(field: FieldDef, index: number): FormData[string] {
  switch (field.type) {
    case "text":
      return field.multiline ? LONG_TEXT : "유치도뇨관 교체(16Fr)";
    case "number":
      return field.key === "weightChange"
        ? -1.5
        : Math.min(field.max ?? 100, 12 + index);
    case "single": {
      // 하나 고르기는 괄호가 있는 선택지를 우선 골라 괄호 자리도 확인한다.
      const option = field.options.find((o) => o.detail) ?? field.options[0];
      return { value: option.value, detail: detailFor(option.detail) };
    }
    case "multi":
      return field.options.map((option) => ({
        value: option.value,
        detail: detailFor(option.detail),
      }));
  }
}

function detailFor(detail: OptionDetail | undefined): string | null {
  if (detail?.kind === "choice") return detail.options[1]?.value ?? null;
  if (detail?.kind === "text") return "괄호 내용";
  return null;
}

/** 서식의 모든 칸을 채운 값. */
export function fullFormData(formId: FormId): FormData {
  return Object.fromEntries(
    formFields(FORMS[formId]).map((field, index) => [
      field.key,
      fullValue(field, index),
    ]),
  );
}

/** 표본 방문. 날짜·시각은 글자가 가장 긴 값(12월, 두 자리 날·시)이라 조정 화면에서 좁은 칸이 드러난다. */
export function sampleRecord(
  formId: FormId,
  overrides: Partial<PdfVisitRecord> = {},
): PdfVisitRecord {
  return {
    formId,
    data: fullFormData(formId),
    header: SAMPLE_HEADER,
    profession:
      formId === "HOME_CARE_NURSE" || formId === "LTC_NURSING"
        ? "NURSE"
        : formId === "HOME_CARE_SOCIAL"
          ? "SOCIAL_WORKER"
          : "DOCTOR",
    visitDate: "2026-12-22",
    startedAt: "2026-12-22T01:10:00.000Z",
    endedAt: "2026-12-22T01:40:00.000Z",
    version: 1,
    confirmedAt: "2026-12-22T02:00:00.000Z",
    confirmedByName: "정의사",
    hashMatches: true,
    ...overrides,
  };
}

/** 하나 고르기 칸도 모든 선택지를 고른 값(조정 화면에서 모든 □·○ 자리에 표시가 나오게). */
function allOptionsFormData(formId: FormId): FormData {
  const data = fullFormData(formId);
  for (const field of formFields(FORMS[formId])) {
    if (field.type !== "single") continue;
    data[field.key] = field.options.map((option) => ({
      value: option.value,
      detail: detailFor(option.detail),
    }));
  }
  return data;
}

/**
 * 원본 서식 조정 화면의 표본. 제7호는 다섯 칸을 모두 채운다(정기 2건·추가 3건, 체중 증·감 둘 다).
 */
export function layoutPreviewRecords(formId: FormId): PdfVisitRecord[] {
  if (formId !== "HOME_CARE_NURSE") {
    return [sampleRecord(formId, { data: allOptionsFormData(formId) })];
  }
  const types = [
    "REGULAR",
    "REGULAR",
    "ADDITIONAL",
    "ADDITIONAL",
    "ADDITIONAL",
  ];
  return types.map((visitType, i) =>
    sampleRecord(formId, {
      data: {
        ...allOptionsFormData(formId),
        visitType: { value: visitType },
        weightChange: i % 2 === 0 ? 1.2 : -1.5,
      },
      visitDate: `2026-12-${String(3 + i * 6).padStart(2, "0")}`,
    }),
  );
}
