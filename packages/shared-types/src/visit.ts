import { z } from "zod";
import {
  FORM_IDS,
  FORMS,
  formDataSchema,
  type FormId,
  type VisitForms,
} from "./forms/index.js";
import { PROGRAMS, type Program } from "./programs.js";
import type { Recipient } from "./recipient.js";
import type { Profession } from "./roles.js";
import { blankToNull } from "./schema.js";

export const VISIT_STATUSES = ["SCHEDULED", "DRAFT", "CONFIRMED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  SCHEDULED: "예정",
  DRAFT: "작성 중",
  CONFIRMED: "확정",
};

/** 예정 상태의 방문만 지울 수 있다(기록이 생기면 남긴다). */
export function canDeleteVisit(status: VisitStatus): boolean {
  return status === "SCHEDULED";
}

/** 확정된 기록은 더 이상 고칠 수 없다. */
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

/** 확정 전 방문의 서식 바꾸기(선택 서식 켜고 끄기). 뺀 서식에 저장한 값은 지워진다. */
export const UpdateVisitFormsSchema = z.object({ formIds: visitFormIds });
export type UpdateVisitFormsInput = z.input<typeof UpdateVisitFormsSchema>;

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
export interface VisitListResponse {
  items: VisitSummary[];
  /** 조건에 맞는 전체 건수 */
  total: number;
  /** 조건에 맞는 방문의 상태별 건수 */
  statusCounts: Record<VisitStatus, number>;
  page: number;
  pageSize: number;
}
