import { z } from "zod";
import {
  FORM_IDS,
  FORMS,
  formDataSchema,
  type FormId,
  type VisitForms,
} from "./forms/index.js";
import { daysBetween, formatKstDate, monthOf } from "./date.js";
import {
  HOME_CARE_MONTHLY_VISITS,
  PROGRAMS,
  visitProfession,
  type Program,
} from "./programs.js";
import type { CareGrade, Recipient } from "./recipient.js";
import type { Profession } from "./roles.js";
import { blankToNull } from "./schema.js";

export const VISIT_STATUSES = ["SCHEDULED", "DRAFT", "CONFIRMED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  SCHEDULED: "예정",
  DRAFT: "작성 중",
  CONFIRMED: "확정",
};

/** 상태별 건수를 0으로 채운 객체. */
export function emptyStatusCounts(): Record<VisitStatus, number> {
  return { SCHEDULED: 0, DRAFT: 0, CONFIRMED: 0 };
}

/** 아직 확정하지 않은 방문 수(예정 + 작성 중). */
export function unconfirmedCount(counts: Record<VisitStatus, number>): number {
  return counts.SCHEDULED + counts.DRAFT;
}

/** 상태별 건수의 합. */
export function totalCount(counts: Record<VisitStatus, number>): number {
  return counts.SCHEDULED + counts.DRAFT + counts.CONFIRMED;
}

/** 예정 상태의 방문만 지울 수 있다(기록이 생기면 남긴다). */
export function canDeleteVisit(status: VisitStatus): boolean {
  return status === "SCHEDULED";
}

/** 확정된 기록은 바로 고칠 수 없다. 담당자가 [수정]으로 작성 중으로 되돌린 뒤 고친다(canReopenVisit). */
export function isRecordEditable(status: VisitStatus): boolean {
  return status !== "CONFIRMED";
}

/** 기록을 쓸 수 있는 사람인지. 담당자 본인만, 확정 전까지. 서버도 같은 규칙을 강제한다. */
export function canWriteRecord(
  visit: { status: VisitStatus; staff: { id: string } },
  userId: string,
): boolean {
  return isRecordEditable(visit.status) && visit.staff.id === userId;
}

/**
 * 확정된 기록을 다시 고칠 수 있는지. 담당자 본인만 [수정]으로 작성 중으로 되돌리고,
 * 고친 뒤 다시 확정한다. 서버도 같은 규칙을 강제한다.
 */
export function canReopenVisit(
  visit: { status: VisitStatus; staff: { id: string } },
  userId: string,
): boolean {
  return visit.status === "CONFIRMED" && visit.staff.id === userId;
}

/**
 * 방문 일정(날짜·시각)을 옮길 수 있는지. 확정 전까지다(확정 기록은 담당자가 [수정]으로 되돌린 뒤).
 * 서버도 같은 규칙을 강제한다.
 */
export function canRescheduleVisit(status: VisitStatus): boolean {
  return isRecordEditable(status);
}

/**
 * 담당자를 바꿀 수 있는지. 기록을 쓰기 전(예정)만이다.
 * 예정 방문에도 구술이 있을 수 있어 서버가 한 번 더 막는다.
 */
export function canReassignVisit(status: VisitStatus): boolean {
  return status === "SCHEDULED";
}

/** 방문 한 건의 최대 길이. 날짜를 잘못 골라 며칠짜리 방문이 되는 것을 막는다. */
export const MAX_VISIT_HOURS = 24;

/**
 * 방문 시작·종료 시각 규칙. 문제가 없으면 null, 있으면 한국어 문구.
 * 저장 스키마, 서버(저장된 값과 합친 뒤), 웹 폼이 모두 이 함수를 쓴다.
 */
export function checkVisitTimes(
  startedAt: Date | string | null | undefined,
  endedAt: Date | string | null | undefined,
): string | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (end < start) return "종료 시각이 시작 시각보다 빠릅니다";
  if (end - start > MAX_VISIT_HOURS * 60 * 60 * 1000) {
    return `방문 시간은 ${MAX_VISIT_HOURS}시간을 넘을 수 없습니다. 방문 날짜를 확인해 주세요`;
  }
  return null;
}

const isoDateTime = (message: string) =>
  z.iso.datetime({ offset: true, message });

/** 방문에서 쓸 서식 목록. 필수·선택 규칙은 서버가 사업·담당자 직종으로 확인한다(selectForms). */
const visitFormIds = z
  .array(z.enum(FORM_IDS), "서식을 하나 이상 골라 주세요")
  .min(1, "서식을 하나 이상 골라 주세요");

export const CreateVisitSchema = z.object({
  recipientId: z.uuid("수급자를 선택해 주세요"),
  program: z.enum(PROGRAMS, "사업을 선택해 주세요"),
  /** 현장 직원이 직접 만들면 무시되고 본인으로 고정된다. */
  staffId: blankToNull(z.uuid("담당자를 선택해 주세요")),
  scheduledAt: isoDateTime("방문 일시 형식이 올바르지 않습니다"),
  /** 쓸 서식(필수 서식 포함). 없으면 사업·직종의 기본값(필수 + 미리 켜 둔 선택 서식). */
  formIds: visitFormIds.optional(),
});
export type CreateVisitInput = z.input<typeof CreateVisitSchema>;

/**
 * 만들려는 방문의 같은 날 경고(conflictsOnSameDay)를 묻는다. 담당자는 방문 만들기와 같이
 * 현장 직원이면 본인, 아니면 staffId(없으면 본인)다.
 */
export const SameDayWarningQuerySchema = z.object({
  recipientId: z.uuid("수급자를 선택해 주세요"),
  program: z.enum(PROGRAMS, "사업을 선택해 주세요"),
  staffId: z.uuid().optional(),
  /** 방문 날짜(한국 날짜 YYYY-MM-DD) */
  date: z.iso.date("방문 날짜 형식이 올바르지 않습니다"),
});
export type SameDayWarningQuery = z.input<typeof SameDayWarningQuerySchema>;

export interface SameDayWarningResponse {
  /** 경고 문구. 없으면 빈 배열이다. */
  warnings: string[];
}

/** 확정 전 방문의 서식 바꾸기(선택 서식 켜고 끄기). 뺀 서식에 저장한 값은 지워진다. */
export const UpdateVisitFormsSchema = z.object({ formIds: visitFormIds });
export type UpdateVisitFormsInput = z.input<typeof UpdateVisitFormsSchema>;

/**
 * 방문 일정·담당자 바꾸기(기관 관리자·운영자). 바꿀 것만 보낸다.
 * - 일정은 확정 전 방문만(canRescheduleVisit), 담당자는 예정 방문만(canReassignVisit).
 * - formIds는 담당자를 바꿀 때만 보낸다. 없으면 서버가 지금 선택을 이어받아 정한다(formIdsForNewStaff).
 * - expectedScheduledAt: 화면이 본 방문 일시. 그사이 다른 사람이 옮겼으면 409.
 */
export const UpdateVisitSchema = z
  .object({
    scheduledAt: isoDateTime("방문 일시 형식이 올바르지 않습니다").optional(),
    staffId: z.uuid("담당자를 선택해 주세요").optional(),
    formIds: visitFormIds.optional(),
    expectedScheduledAt: isoDateTime(
      "방문 일시 형식이 올바르지 않습니다",
    ).optional(),
  })
  .refine(
    ({ scheduledAt, staffId }) =>
      scheduledAt !== undefined || staffId !== undefined,
    { message: "바꿀 내용이 없습니다" },
  )
  .refine(
    ({ formIds, staffId }) => formIds === undefined || staffId !== undefined,
    {
      message: "서식은 담당자를 바꿀 때만 함께 보냅니다",
      path: ["formIds"],
    },
  );
export type UpdateVisitInput = z.input<typeof UpdateVisitSchema>;

export const VISIT_LIST_DEFAULT_PAGE_SIZE = 50;
export const VISIT_LIST_MAX_PAGE_SIZE = 200;

/**
 * 날짜는 모두 한국 시간(KST) 기준 YYYY-MM-DD. `to`는 그날을 포함한다.
 * 결과는 방문 일시 오름차순이고 page(1부터)·pageSize로 나눠 준다.
 */
export const VisitListQuerySchema = z
  .object({
    date: z.iso.date().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    staffId: z.uuid().optional(),
    recipientId: z.uuid().optional(),
    program: z.enum(PROGRAMS).optional(),
    status: z.enum(VISIT_STATUSES).optional(),
    organizationId: z.uuid().optional(),
    /**
     * "organization"이면 기관별로(기관 이름순, 그 안은 방문 일시순) 이어서 주고
     * 기관별 건수(organizationCounts)도 준다. 운영자가 전체 기관을 기관별로 묶어 볼 때 쓴다.
     */
    groupBy: z.enum(["organization"]).optional(),
    page: z.coerce
      .number("page는 숫자여야 합니다")
      .int("page는 정수여야 합니다")
      .min(1, "page는 1 이상이어야 합니다")
      .default(1),
    pageSize: z.coerce
      .number("pageSize는 숫자여야 합니다")
      .int("pageSize는 정수여야 합니다")
      .min(1, "pageSize는 1 이상이어야 합니다")
      .max(
        VISIT_LIST_MAX_PAGE_SIZE,
        `pageSize는 ${VISIT_LIST_MAX_PAGE_SIZE} 이하여야 합니다`,
      )
      .default(VISIT_LIST_DEFAULT_PAGE_SIZE),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: "시작일이 종료일보다 늦습니다",
    path: ["from"],
  });
export type VisitListQuery = z.input<typeof VisitListQuerySchema>;

/** 달력 한 장(6주)을 한 번에 센다. */
export const VISIT_CALENDAR_MAX_DAYS = 42;

/**
 * 달력에 싣는 방문 항목의 상한. 넘으면(운영자의 전체 기관 보기 등) 항목 없이 건수만 준다.
 * 한 기관의 6주는 보통 이보다 훨씬 적다.
 */
export const VISIT_CALENDAR_MAX_ITEMS = 3000;

/**
 * 방문 달력: 기간 안의 날짜별 상태 건수. 날짜는 한국 날짜이고 `to`는 그날을 포함한다.
 * 권한 범위와 필터(담당자·사업·상태·기관)는 방문 목록과 같다.
 */
export const VisitCalendarQuerySchema = z
  .object({
    from: z.iso.date("시작일 형식이 올바르지 않습니다"),
    to: z.iso.date("종료일 형식이 올바르지 않습니다"),
    staffId: z.uuid().optional(),
    program: z.enum(PROGRAMS).optional(),
    status: z.enum(VISIT_STATUSES).optional(),
    organizationId: z.uuid().optional(),
    recipientId: z.uuid().optional(),
    /** "true"면 날짜별 건수와 함께 가벼운 방문 목록도 싣는다(관리 웹 달력 칩). */
    withVisits: z.enum(["true", "false"]).optional(),
  })
  .refine(({ from, to }) => from <= to, {
    message: "시작일이 종료일보다 늦습니다",
    path: ["from"],
  })
  .refine(({ from, to }) => daysBetween(from, to) < VISIT_CALENDAR_MAX_DAYS, {
    message: `달력은 한 번에 ${VISIT_CALENDAR_MAX_DAYS}일까지 볼 수 있습니다`,
    path: ["to"],
  });
export type VisitCalendarQuery = z.input<typeof VisitCalendarQuerySchema>;

/**
 * 서식별 값 묶음. 서식마다 그 서식 정의로 검사하고, 통과한 값(빈 칸 채움·모르는 칸 제거)을 돌려준다.
 * 방문에 딸리지 않은 서식인지는 서버가 확인한다.
 */
export const VisitFormsSchema = z
  .partialRecord(z.enum(FORM_IDS), z.record(z.string(), z.unknown()))
  .transform((forms, ctx) => {
    const parsed: VisitForms = {};
    for (const [formId, data] of Object.entries(forms) as [FormId, unknown][]) {
      const form = FORMS[formId];
      const result = formDataSchema(form).safeParse(data);
      if (result.success) {
        parsed[formId] = result.data;
        continue;
      }
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: "custom",
          message: `${form.shortTitle} · ${issue.message}`,
          path: [formId, ...issue.path],
        });
      }
    }
    return parsed;
  });

export const SaveVisitRecordSchema = z
  .object({
    forms: VisitFormsSchema,
    startedAt: isoDateTime("방문 시작 시각 형식이 올바르지 않습니다").nullish(),
    endedAt: isoDateTime("방문 종료 시각 형식이 올바르지 않습니다").nullish(),
  })
  .superRefine(({ startedAt, endedAt }, ctx) => {
    // 한쪽만 보낸 요청은 서버가 저장된 값과 합쳐 같은 함수로 다시 확인한다.
    const message = checkVisitTimes(startedAt, endedAt);
    if (message) ctx.addIssue({ code: "custom", message, path: ["endedAt"] });
  });
export type SaveVisitRecordInput = z.input<typeof SaveVisitRecordSchema>;

/** 방문 목록에 싣는 수급자 정보. 연락처·보호자·메모는 상세에서만 준다. */
export type VisitRecipientSummary = Pick<
  Recipient,
  "id" | "name" | "careGrade" | "address"
>;

/** 방문 상세에 싣는 수급자 정보. */
export type VisitRecipient = Pick<
  Recipient,
  | "id"
  | "name"
  | "birthDate"
  | "gender"
  | "careGrade"
  | "phone"
  | "address"
  | "guardianName"
  | "guardianPhone"
  | "notes"
  | "ltcCertNumber"
>;

export interface VisitStaff {
  id: string;
  name: string;
  profession: Profession | null;
}

interface VisitBase {
  id: string;
  organizationId: string;
  program: Program;
  status: VisitStatus;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  confirmedAt: string | null;
  staff: VisitStaff;
  /**
   * 이 방문에서 쓰는 서식(규칙 순서). 방문을 만들 때 사업·담당자 직종의 규칙 안에서 고르고,
   * 확정 전까지 선택 서식을 켜고 끌 수 있다.
   */
  formIds: FormId[];
}

export interface VisitSummary extends VisitBase {
  recipient: VisitRecipientSummary;
}

export interface VisitDetail extends VisitBase {
  recipient: VisitRecipient;
  /** 서식 머리(기관정보)에 적는 값 */
  organization: { name: string; code: string | null };
  staff: VisitStaff & { licenseNumber: string | null };
  /** 저장한 서식 값. 아직 저장하지 않은 서식은 없다. */
  forms: VisitForms;
  /**
   * 같은 수급자의 지난 서식에서 가져온 기본값(이월 칸만). 아직 저장하지 않은 서식을 처음 열 때 쓴다.
   */
  carryOver: VisitForms;
}

/** 방문 목록 응답. 건수는 페이지와 상관없이 조건에 맞는 전체 기준이다. */
/** 한 기관의 방문 건수(조건 전체 기준). */
export interface VisitOrganizationCount {
  organizationId: string;
  total: number;
  statusCounts: Record<VisitStatus, number>;
}

export interface VisitListResponse {
  items: VisitSummary[];
  /** 조건에 맞는 전체 건수 */
  total: number;
  /** 조건에 맞는 방문의 상태별 건수 */
  statusCounts: Record<VisitStatus, number>;
  /** groupBy=organization일 때만: 기관별 건수(순서 없음). 받은 페이지와 상관없이 조건 전체 기준이다. */
  organizationCounts?: VisitOrganizationCount[];
  page: number;
  pageSize: number;
}

/** 달력의 하루: 그날 방문의 상태별 건수. */
export interface VisitCalendarDay {
  /** YYYY-MM-DD (한국 날짜) */
  date: string;
  counts: Record<VisitStatus, number>;
  total: number;
}

/** 달력 칩에 쓰는 가벼운 방문 항목. 주소·연락처는 싣지 않는다. */
export interface VisitCalendarItem {
  id: string;
  organizationId: string;
  program: Program;
  status: VisitStatus;
  scheduledAt: string;
  /** 방문을 만들 때 고정한 서식. 방문한 직종 판정(visitProfession)에도 쓴다. */
  formIds: FormId[];
  recipient: { id: string; name: string; careGrade: CareGrade | null };
  staff: VisitStaff & { isActive: boolean };
}

export interface VisitCalendarResponse {
  /** 방문이 있는 날만, 날짜 오름차순 */
  days: VisitCalendarDay[];
  /**
   * withVisits일 때만 있다. 방문 일시·id 오름차순.
   * 상한(VISIT_CALENDAR_MAX_ITEMS)을 넘으면 null이다(건수만 쓴다).
   */
  visits?: VisitCalendarItem[] | null;
}

/**
 * 방문을 한국 날짜별 상태 건수로 묶는다. 방문이 있는 날만, 날짜 오름차순.
 * 방문 일시는 UTC로 저장되므로 한국 날짜로 바꿔서 센다(자정 직후 방문이 전날로 가지 않게).
 */
export function countVisitsByDay(
  visits: readonly { scheduledAt: Date | string; status: VisitStatus }[],
): VisitCalendarDay[] {
  const byDate = new Map<string, Record<VisitStatus, number>>();
  for (const visit of visits) {
    const date = formatKstDate(new Date(visit.scheduledAt));
    const counts = byDate.get(date) ?? emptyStatusCounts();
    counts[visit.status] += 1;
    byDate.set(date, counts);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, counts]) => ({ date, counts, total: totalCount(counts) }));
}

/** 달력 한 장의 요약(두 웹의 달력 머리·지난 미확정 안내). */
export interface CalendarMonthSummary {
  /** 그 달(앞뒤 달 칸 제외)의 상태별 건수 */
  counts: Record<VisitStatus, number>;
  total: number;
  /** 달력 칸(앞뒤 달 포함)에서 오늘 전 날짜의 확정 안 한 방문 수 */
  overdue: number;
  /** 그중 가장 이른 날. 없으면 null */
  firstOverdue: string | null;
}

export function summarizeCalendarMonth(
  days: Iterable<VisitCalendarDay>,
  month: string,
  today: string,
): CalendarMonthSummary {
  const counts = emptyStatusCounts();
  let overdue = 0;
  let firstOverdue: string | null = null;
  for (const day of days) {
    if (monthOf(day.date) === month) {
      for (const status of VISIT_STATUSES) counts[status] += day.counts[status];
    }
    const unconfirmed = unconfirmedCount(day.counts);
    if (day.date < today && unconfirmed > 0) {
      overdue += unconfirmed;
      if (!firstOverdue || day.date < firstOverdue) firstOverdue = day.date;
    }
  }
  return { counts, total: totalCount(counts), overdue, firstOverdue };
}

/** 재택의료센터 방문의 직종별 건수. */
export type HomeCareVisitCounts = Record<
  keyof typeof HOME_CARE_MONTHLY_VISITS,
  number
>;

export function emptyHomeCareCounts(): HomeCareVisitCounts {
  return { DOCTOR: 0, NURSE: 0, SOCIAL_WORKER: 0 };
}

/** 이달 수급자 한 명의 방문 요약(관리 웹 달력의 수급자 패널). */
export interface MonthRecipientSummary {
  recipient: VisitCalendarItem["recipient"];
  organizationId: string;
  total: number;
  confirmed: number;
  /** 이달 첫 방문 날짜 */
  firstDate: string;
  /** 재택의료센터 방문이 있으면 직종별 건수(방문의 서식으로 판정), 없으면 null */
  homeCare: HomeCareVisitCounts | null;
  /** 재택의료 월 요건(HOME_CARE_MONTHLY_VISITS)에서 모자란 건수의 합. 0이면 충족 */
  homeCareShortfall: number;
}

/** 모자란 재택의료 방문 수(직종별 요건과 비교). */
export function homeCareShortfall(counts: HomeCareVisitCounts): number {
  return (
    Object.entries(HOME_CARE_MONTHLY_VISITS) as [
      keyof HomeCareVisitCounts,
      number,
    ][]
  ).reduce(
    (sum, [profession, required]) =>
      sum + Math.max(0, required - counts[profession]),
    0,
  );
}

/**
 * 달력 항목을 수급자별로 묶는다(month 안의 방문만). 이름순이다.
 * 재택의료 직종별 건수는 담당자의 지금 직종이 아니라 방문의 서식으로 센다.
 */
export function summarizeMonthRecipients(
  items: readonly VisitCalendarItem[],
  month: string,
): MonthRecipientSummary[] {
  const byRecipient = new Map<string, MonthRecipientSummary>();
  for (const item of items) {
    const date = formatKstDate(new Date(item.scheduledAt));
    if (monthOf(date) !== month) continue;
    let summary = byRecipient.get(item.recipient.id);
    if (!summary) {
      summary = {
        recipient: item.recipient,
        organizationId: item.organizationId,
        total: 0,
        confirmed: 0,
        firstDate: date,
        homeCare: null,
        homeCareShortfall: 0,
      };
      byRecipient.set(item.recipient.id, summary);
    }
    summary.total += 1;
    if (item.status === "CONFIRMED") summary.confirmed += 1;
    if (date < summary.firstDate) summary.firstDate = date;
    if (item.program === "HOME_CARE_CENTER") {
      summary.homeCare ??= emptyHomeCareCounts();
      const profession = visitProfession(item.program, item.formIds);
      if (profession) summary.homeCare[profession] += 1;
    }
  }
  const summaries = [...byRecipient.values()];
  for (const summary of summaries) {
    summary.homeCareShortfall = summary.homeCare
      ? homeCareShortfall(summary.homeCare)
      : 0;
  }
  return summaries.sort((a, b) =>
    a.recipient.name.localeCompare(b.recipient.name, "ko"),
  );
}
