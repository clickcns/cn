import {
  addKstDays,
  formatKstDate,
  formatKstTime,
  formRulesFor,
  FORMS,
  isIsoDate,
  SaveVisitRecordSchema,
  toKstIsoDateTime,
  type FormId,
  type SaveVisitRecordInput,
  type VisitDetail,
} from "@repo/shared-types";
import {
  fromFormState,
  toFormState,
  type FormState,
} from "@/features/forms/lib/form-state";

/*
 * 방문 기록 폼: 방문 날짜·시각과 이 방문의 서식들(forms.서식ID).
 * 폼은 입력 중인 글자를 그대로 들고 있도록 숫자도 문자열로 다루고,
 * 저장할 때 서식 값으로 바꿔 SaveVisitRecordSchema(서식 정의)로 검사한다.
 */

export interface RecordFormValues {
  /** 실제 방문 날짜(YYYY-MM-DD, 한국 날짜). 시작 시각은 이 날짜 기준이다. */
  visitDate: string;
  /** HH:mm 또는 "" */
  startTime: string;
  /** HH:mm 또는 "" */
  endTime: string;
  /**
   * 자정을 넘겨 방문 날짜 다음 날에 끝났는지. 종료 시각이 시작보다 빠르다고
   * 자동으로 켜지 않는다(오타가 23시간짜리 방문이 되지 않게 사용자가 직접 켠다).
   */
  endsNextDay: boolean;
  /** 서식별 입력 상태 */
  forms: Record<string, FormState>;
}

/**
 * 방문 예정 시각의 한국 날짜(YYYY-MM-DD). 기록된 시각이 없을 때 방문 날짜의 기본값이다.
 * 실제 방문 날짜는 예정일과 다를 수 있다(`RecordFormValues.visitDate`).
 */
export function getVisitDate(visit: Pick<VisitDetail, "scheduledAt">): string {
  return formatKstDate(new Date(visit.scheduledAt));
}

const isoToTime = (iso: string | null) =>
  iso ? formatKstTime(new Date(iso)) : "";

const isoToDate = (iso: string | null) =>
  iso ? formatKstDate(new Date(iso)) : null;

/** 서식 한 장의 시작 상태: 저장한 값, 없으면 지난 방문에서 가져온 이월 값. */
export function toFormInitialState(
  visit: VisitDetail,
  formId: FormId,
): FormState {
  return toFormState(
    FORMS[formId],
    visit.forms[formId] ?? visit.carryOver[formId],
  );
}

/**
 * 방문의 서식은 저장한 값이나 이월 값으로 시작한다. 켜지 않은 선택 서식도 빈 상태로 넣어 두어
 * 서식을 더하고 뺄 때 폼의 기본값이 있게 한다(뺀 서식을 기본값으로 되돌려 "저장 안 됨"이 남지 않게).
 */
export function toRecordFormValues(visit: VisitDetail): RecordFormValues {
  const formIds = new Set([
    ...visit.formIds,
    ...formRulesFor(visit.program, visit.profession).map((rule) => rule.formId),
  ]);

  const startDate = isoToDate(visit.startedAt);
  const endDate = isoToDate(visit.endedAt);

  return {
    visitDate: startDate ?? endDate ?? getVisitDate(visit),
    startTime: isoToTime(visit.startedAt),
    endTime: isoToTime(visit.endedAt),
    // YYYY-MM-DD는 문자열 비교가 곧 날짜 비교다.
    endsNextDay: startDate !== null && endDate !== null && endDate > startDate,
    forms: Object.fromEntries(
      [...formIds].map((formId) => [formId, toFormInitialState(visit, formId)]),
    ),
  };
}

export type VisitTimesResult =
  | { ok: true; startedAt: string | null; endedAt: string | null }
  | { ok: false; message: string };

/**
 * 방문 날짜·시각 입력 → 저장할 ISO 시각(빈 시각은 null).
 * 다음 날 종료면 종료 시각은 방문 날짜 다음 날 기준이다. 시각 규칙 검사는 하지 않는다.
 */
export function toVisitTimes(
  values: Pick<
    RecordFormValues,
    "visitDate" | "startTime" | "endTime" | "endsNextDay"
  >,
): VisitTimesResult {
  const { visitDate, startTime, endTime, endsNextDay } = values;
  if (!isIsoDate(visitDate)) {
    return { ok: false, message: "방문 날짜를 확인해 주세요" };
  }
  const endDate = endsNextDay ? addKstDays(visitDate, 1) : visitDate;
  return {
    ok: true,
    startedAt: startTime ? toKstIsoDateTime(visitDate, startTime) : null,
    endedAt: endTime ? toKstIsoDateTime(endDate, endTime) : null,
  };
}

export type BuildSaveInputResult =
  { ok: true; input: SaveVisitRecordInput } | { ok: false; message: string };

/** 폼 값 → 저장 요청(방문의 서식 모두). 검사에 실패하면 첫 오류 문구를 돌려준다. */
export function buildSaveInput(
  values: RecordFormValues,
  formIds: readonly FormId[],
): BuildSaveInputResult {
  const times = toVisitTimes(values);
  if (!times.ok) return times;

  const input: SaveVisitRecordInput = {
    forms: Object.fromEntries(
      formIds.map((formId) => [
        formId,
        fromFormState(FORMS[formId], values.forms[formId] ?? {}),
      ]),
    ),
    startedAt: times.startedAt,
    endedAt: times.endedAt,
  };

  const parsed = SaveVisitRecordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "입력한 내용을 확인해 주세요",
    };
  }
  return { ok: true, input };
}
