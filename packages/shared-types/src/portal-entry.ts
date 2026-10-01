import { z } from "zod";
import { addMonths, formatKstTime, monthOf } from "./date.js";
import {
  findOption,
  FORMS,
  isEmptyValue,
  optionDetailText,
  signedChange,
  type ChoiceFieldDef,
  type FieldDef,
  type FieldValue,
  type FormId,
  type Portal,
  type SelectedOption,
} from "./forms/index.js";
import type { CareGrade } from "./recipient.js";
import { recordDate } from "./record-history.js";
import { optionalText } from "./schema.js";
import type { VisitDetail, VisitStaff } from "./visit.js";

/*
 * 공식 전산 입력 도우미. 케어노트는 심평원·공단 전산과 연결되지 않아(공개 API 없음) 담당자가
 * 확정한 기록을 옮겨 적는다. 서식이 어디로 가는지는 서식 정의(FormDef.portal)에 있고, 여기서는
 * 포털 안내, 그 화면 순서대로 늘어놓은 값, 제출 전에 볼 것을 만든다. 다 넣으면 서식마다 한 번
 * [입력 완료]로 표시한다(칸마다 체크하지 않는다). 케어노트는 인증서를 다루지 않는다.
 */

export interface PortalInfo {
  /** "심평원 시범사업 자료제출 시스템" */
  label: string;
  /** "심평원" */
  short: string;
  url: string;
  linkLabel: string;
  /** 로그인 안내(케어노트는 인증서를 쓰지 않는다) */
  login: string;
  /** 칸을 늘어놓은 순서의 근거. 확인 전이면 그렇다고 적는다. */
  orderNote: string;
  /** 서식 칸 앞뒤로 포털에서 하는 일(태그 인식, 임시저장·최종 제출 등) */
  before: readonly string[];
  after: readonly string[];
  /** 제출 전에 늘 보여 주는 주의 */
  cautions: readonly string[];
}

export const PORTAL_INFO: Record<Portal, PortalInfo> = {
  HIRA: {
    label: "심평원 시범사업 자료제출 시스템",
    short: "심평원",
    url: "https://biz.hira.or.kr",
    linkLabel: "요양기관업무포털 열기",
    login: "로그인은 이 PC에서 본인 공동인증서로 합니다",
    orderNote: "점검서식 칸은 별지 제4호 순서입니다",
    before: [],
    after: ["임시저장 → 화면 값 확인 → 최종 제출(담당자가 직접 누릅니다)"],
    cautions: [
      "명세서보다 점검서식을 먼저 제출해야 방문진료료가 산정됩니다",
      "최종 제출하면 고칠 수 없습니다. 임시저장한 뒤 화면 값을 한 번 더 확인하세요",
    ],
  },
  NHIS_HOME_CARE: {
    label: "공단 요양기관정보마당(재택의료센터 전산)",
    short: "공단",
    url: "https://medicare.nhis.or.kr",
    linkLabel: "요양기관정보마당 열기",
    login: "로그인은 이 PC에서 기관 인증서로 합니다",
    orderNote:
      "정보마당 입력 화면의 칸 순서는 확인 전이라 별지 서식 순서로 늘어놓았습니다",
    before: [],
    after: ["저장 → [작성완료](작성완료한 건만 청구명세서에 들어갑니다)"],
    cautions: [
      "청구는 다음 달 10일까지입니다. 작성완료하지 않은 건은 청구에서 빠집니다",
      "정보마당에서 출력한 기록지는 원본이 아닙니다. 원본은 케어노트 확정본으로 보관합니다",
    ],
  },
  NHIS_LTC_APP: {
    label: "공단 스마트장기요양 앱",
    short: "앱",
    url: "https://play.google.com/store/apps/details?id=kr.or.nhis.longtermcare.android",
    linkLabel: "스마트장기요양 앱",
    login: "로그인은 앱에서 본인 인증서로 합니다",
    orderNote: "앱 순서는 공단 재가급여전자관리 가이드북(2023.12) 기준입니다",
    before: ["태그 인식(수급자 집 NFC 태그)"],
    after: ["요양요원 서명 → 수급자(보호자) 서명 → 종료 전송"],
    cautions: [
      "태그 인식 후 10분 안에 종료 전송해야 합니다",
      "특이사항 칸은 200자까지입니다",
    ],
  },
};

/* ---------- 옮겨 적을 값 ---------- */

/** 붙여 넣을 값 하나. text가 복사되는 값이고, suffix(단위)는 화면에만 붙인다. */
export interface PortalValue {
  text: string;
  /** 값이 무엇인지(괄호 칸 이름 등). 없으면 줄 이름으로 충분하다. */
  label?: string;
  suffix?: string;
}

/** 포털 칸 하나: 체크할 항목과 붙여 넣을 값. 둘 다 없으면 비워 둘 칸이다. */
export interface PortalRow {
  key: string;
  label: string;
  checks: string[];
  values: PortalValue[];
  note?: string;
}

export interface PortalSection {
  title: string;
  rows: PortalRow[];
}

const emptyRow = (key: string, label: string): PortalRow => ({
  key,
  label,
  checks: [],
  values: [],
});

/** 고른 항목 하나를 포털 칸에: 체크할 이름("욕창 관리 · 15분", "자원연계 제공(정보제공)")과 괄호 글·메모. */
function addOption(
  row: PortalRow,
  field: ChoiceFieldDef,
  selected: SelectedOption,
): void {
  const option = findOption(field, selected.value);
  if (!option) {
    row.checks.push(selected.value);
    return;
  }
  let check = option.label;
  if (selected.detail) {
    if (option.detail?.kind === "text") {
      row.values.push({
        text: selected.detail,
        label: `${option.label} · ${option.detail.label}`,
      });
    } else {
      check = `${option.label}(${optionDetailText(option, selected.detail)})`;
    }
  }
  if (selected.minutes != null) check = `${check} · ${selected.minutes}분`;
  row.checks.push(check);
  if (selected.note) {
    row.values.push({ text: selected.note, label: `${option.label} 메모` });
  }
}

function fieldRow(field: FieldDef, value: FieldValue | undefined): PortalRow {
  const row = emptyRow(field.key, field.label);
  if (isEmptyValue(value)) return row;
  switch (field.type) {
    case "single":
    case "multi":
      for (const selected of Array.isArray(value)
        ? value
        : [value as SelectedOption]) {
        addOption(row, field, selected);
      }
      break;
    case "number": {
      const number = value as number;
      if (field.signed) {
        // 증감 칸: 증·감을 고르고 크기를 적는다.
        const { direction, amount } = signedChange(number);
        row.checks.push(direction);
        if (amount > 0) {
          row.values.push({ text: String(amount), suffix: field.unit });
        }
      } else {
        row.values.push({ text: String(number), suffix: field.unit });
      }
      break;
    }
    case "text":
      row.values.push({ text: (value as string).trim() });
      break;
  }
  return row;
}

type PortalVisit = Pick<
  VisitDetail,
  | "scheduledAt"
  | "startedAt"
  | "endedAt"
  | "confirmedAt"
  | "staff"
  | "recipient"
  | "forms"
>;

/** 서식 칸 앞에 포털 화면 맨 위에서 적는 칸(작성자·날짜·수급자). 서식 값이 아니라 방문 정보에서 온다. */
function headerSection(portal: Portal, visit: PortalVisit): PortalSection {
  const row = (
    key: string,
    label: string,
    text: string | null,
    note?: string,
  ): PortalRow => ({
    ...emptyRow(key, label),
    values: text ? [{ text }] : [],
    note,
  });
  const recipient = visit.recipient.birthDate
    ? `${visit.recipient.name} ${visit.recipient.birthDate}`
    : visit.recipient.name;
  const start = formatKstTime(new Date(visit.startedAt ?? visit.scheduledAt));
  const timeRange = visit.endedAt
    ? `${start}~${formatKstTime(new Date(visit.endedAt))}`
    : start;
  switch (portal) {
    case "HIRA":
      return {
        title: "작성의사·수진자",
        rows: [
          row("doctorName", "작성의사 성명", visit.staff.name),
          row("license", "면허번호", visit.staff.licenseNumber),
          row(
            "visitDate",
            "방문진료실시일",
            recordDate(visit),
            "진료를 시작한 날",
          ),
          row(
            "patient",
            "수진자 찾기",
            recipient,
            "주민등록번호는 케어노트에 저장하지 않습니다. 심평원 화면의 [재진 불러오기]로 찾으세요",
          ),
        ],
      };
    case "NHIS_HOME_CARE":
      return {
        title: "방문 정보",
        rows: [
          row("recipient", "수급자", recipient),
          row("ltcCert", "장기요양인정번호", visit.recipient.ltcCertNumber),
          row("visitDate", "방문일", recordDate(visit)),
          row("visitTime", "방문 시각", timeRange),
          row("staff", "담당자", visit.staff.name),
        ],
      };
    case "NHIS_LTC_APP":
      return {
        title: "방문 정보",
        rows: [row("visitTime", "방문 시각", timeRange)],
      };
  }
}

/* ---------- 제출 전에 볼 것 ---------- */

export interface PortalCheck {
  ok: boolean;
  text: string;
}

/** 방문 정보로 미리 알 수 있는 확인(면허번호, 실시일, 입력 뒤 다시 확정). */
function visitChecks(
  portal: Portal,
  visit: PortalVisit,
  entry: Pick<PortalEntry, "enteredAt"> | undefined,
): PortalCheck[] {
  const checks: PortalCheck[] = [];
  if (portal === "HIRA") {
    checks.push(
      visit.staff.licenseNumber
        ? { ok: true, text: "작성의사 면허번호가 있습니다" }
        : {
            ok: false,
            text: "담당자 면허번호가 비어 있습니다. 사용자 정보에 넣어 주세요",
          },
    );
  }
  checks.push(
    visit.startedAt
      ? { ok: true, text: "방문 날짜는 실제로 시작한 날로 적었습니다" }
      : {
          ok: false,
          text: "방문 시작 시각이 없어 예정일을 적었습니다. 실제 방문일인지 확인하세요",
        },
  );
  // 확정할 때마다 confirmedAt이 바뀌므로, 표시 뒤에 바뀌었으면 [수정]해 다시 확정한 것이다.
  if (
    entry &&
    visit.confirmedAt &&
    Date.parse(visit.confirmedAt) > Date.parse(entry.enteredAt)
  ) {
    checks.push({
      ok: false,
      text: "포털에 넣은 뒤 기록을 다시 확정했습니다. 포털 값도 바꿔야 하는지 확인하세요",
    });
  }
  return checks;
}

/* ---------- 도우미 한 장 ---------- */

/** 서식 하나를 옮겨 적는 데 필요한 것: 포털 안내, 화면 순서대로 늘어놓은 칸, 제출 전 확인. */
export interface PortalGuide {
  info: PortalInfo;
  /** 맨 위 머리 칸(작성자·날짜·수급자) 다음에 서식 구분 순서 */
  sections: PortalSection[];
  /** 방문 정보로 본 확인과 늘 보이는 주의 */
  checks: PortalCheck[];
  checkCount: number;
  valueCount: number;
}

export function portalGuide(
  visit: PortalVisit,
  formId: FormId,
  entry: Pick<PortalEntry, "enteredAt"> | undefined,
): PortalGuide {
  const form = FORMS[formId];
  const info = PORTAL_INFO[form.portal];
  const data = visit.forms[formId];
  const sections = [
    headerSection(form.portal, visit),
    ...form.sections.map((section) => ({
      title: section.title,
      rows: section.fields.map((field) => fieldRow(field, data?.[field.key])),
    })),
  ];
  const rows = sections.flatMap((section) => section.rows);
  return {
    info,
    sections,
    checks: [
      ...visitChecks(form.portal, visit, entry),
      ...info.cautions.map((text) => ({ ok: false, text })),
    ],
    checkCount: rows.reduce((sum, row) => sum + row.checks.length, 0),
    valueCount: rows.reduce((sum, row) => sum + row.values.length, 0),
  };
}

/* ---------- 입력 완료 표시·미입력 목록 ---------- */

/** 서식 하나를 포털에 넣었다는 표시. */
export interface PortalEntry {
  formId: FormId;
  enteredAt: string;
  enteredBy: { id: string; name: string };
  note: string | null;
}

export const MarkPortalEntrySchema = z.object({
  /** 접수번호 등 */
  note: optionalText(200, "메모"),
});
export type MarkPortalEntryInput = z.input<typeof MarkPortalEntrySchema>;

/** 확정했지만 아직 포털에 넣지 않은 서식 하나(미입력 목록). 옮겨 적을 곳은 FORMS[formId].portal. */
export interface PortalQueueItem {
  visitId: string;
  formId: FormId;
  organizationId: string;
  scheduledAt: string;
  recipient: { id: string; name: string; careGrade: CareGrade | null };
  staff: VisitStaff;
}

export interface PortalQueueResponse {
  /** 방문 일시 오름차순(오래된 것부터) */
  items: PortalQueueItem[];
  /** 본 기간(한국 날짜, 끝 포함) */
  from: string;
  to: string;
  /** 기간 안 확정 방문이 너무 많아 앞의 일부만 봤다(기관을 고른다) */
  truncated: boolean;
}

export const PortalQueueQuerySchema = z.object({
  organizationId: z.uuid().optional(),
});
export type PortalQueueQuery = z.input<typeof PortalQueueQuerySchema>;

/**
 * 미입력 목록이 보는 기간의 시작: 지난달 1일(끝은 오늘). 지난달분 청구 마감이 이달 10일이라
 * 지난달까지 보면 되고, 기능을 쓰기 전에 확정한 오래된 방문이 목록을 채우지 않는다.
 */
export function defaultPortalQueueFrom(today: string): string {
  return `${addMonths(monthOf(today), -1)}-01`;
}
