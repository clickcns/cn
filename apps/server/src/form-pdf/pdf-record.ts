import {
  CARE_GRADE_LABELS,
  formatKstDate,
  formatKstTime,
  PROFESSION_LABELS,
  type FormData,
  type FormId,
  type Profession,
  type SelectedOption,
  type VisitRecordHeader,
} from "@repo/shared-types";

/** 서식 한 장을 그리는 데 쓰는 방문 기록(확정본에서 만든다). */
export interface PdfVisitRecord {
  formId: FormId;
  data: FormData;
  header: VisitRecordHeader;
  profession: Profession;
  /** 방문일(한국 날짜 YYYY-MM-DD) */
  visitDate: string;
  startedAt: string | null;
  endedAt: string | null;
  version: number;
  confirmedAt: string;
  confirmedByName: string;
  /** 보관한 값이 확정 때 남긴 hash와 맞는지(확정본 이력의 "원본 그대로입니다") */
  hashMatches: boolean;
}

/** 고른 항목 목록(하나 고르기·여러 개 고르기 모두). */
export function selectedOptions(data: FormData, key: string): SelectedOption[] {
  const value = data[key];
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

export function textValue(data: FormData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

export function numberValue(data: FormData, key: string): number | null {
  const value = data[key];
  return typeof value === "number" ? value : null;
}

/** 서식 머리 칸에 쓰는 글(없으면 빈 글). */
function headerTexts(record: PdfVisitRecord) {
  const { organization, recipient, staff } = record.header;
  return {
    orgName: organization.name,
    orgCode: organization.code ?? "",
    recipientName: recipient.name,
    birthDate: recipient.birthDate ?? "",
    careGrade: recipient.careGrade
      ? CARE_GRADE_LABELS[recipient.careGrade]
      : "",
    ltcCertNumber: recipient.ltcCertNumber ?? "",
    address: recipient.address ?? "",
    staffName: staff.name,
    profession: PROFESSION_LABELS[record.profession],
    licenseNumber: staff.licenseNumber ?? "",
  };
}

/** 방문일을 년·월·일로. */
function dateParts(date: string) {
  const [year = "", month = "", day = ""] = date.split("-");
  return { year, month: String(Number(month)), day: String(Number(day)) };
}

/** 한국 시각 "HH:MM"을 시·분으로. 시각이 없으면 빈 글. */
function timeParts(iso: string | null) {
  if (!iso) return { hour: "", minute: "", text: "" };
  const text = formatKstTime(new Date(iso));
  const [hour = "", minute = ""] = text.split(":");
  return { hour, minute, text };
}

/** 서식 머리·방문일·방문 시각에 쓰는 글(원본 위 채우기와 표준 서식이 함께 쓴다). */
export function recordTexts(record: PdfVisitRecord) {
  return {
    ...headerTexts(record),
    date: dateParts(record.visitDate),
    start: timeParts(record.startedAt),
    end: timeParts(record.endedAt),
  };
}
export type RecordTexts = ReturnType<typeof recordTexts>;

/** 출력 표시(쪽 아래): 어떤 확정본을 뽑았는지. 보관 값이 원본과 다르면 함께 적는다. */
export function footerText(record: PdfVisitRecord): string {
  const confirmed = new Date(record.confirmedAt);
  const text = `케어노트 출력 · ${record.version}차 확정본 · ${formatKstDate(confirmed)} ${formatKstTime(confirmed)} ${record.confirmedByName} 확정`;
  return record.hashMatches ? text : `${text} · 보관 값이 원본과 다릅니다`;
}
