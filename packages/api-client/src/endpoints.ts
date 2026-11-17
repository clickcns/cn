import type {
  AccessLogPage,
  AccessLogQuery,
  AuthResponse,
  AuthUser,
  ChangePasswordInput,
  CreateHomeCareAssessmentInput,
  CreateHomeCareFeeScheduleInput,
  FormLayoutDetail,
  FormLayoutSummary,
  FormId,
  ExternalServiceInput,
  FormPdfQuery,
  HomeCareCase,
  HomeCareFeeScheduleList,
  HomeCareMonthQuery,
  HomeCareMonthResponse,
  MarkPortalEntryInput,
  NurseMonthPdfQuery,
  PortalEntry,
  PortalQueueQuery,
  PortalQueueResponse,
  PreviewFormLayoutInput,
  SaveFormLayoutInput,
  CreateOrganizationInput,
  CreateRecipientInput,
  CreateUserInput,
  CreateVisitInput,
  LoginInput,
  Organization,
  Recipient,
  RecipientListQuery,
  RecipientRecordPage,
  RecipientRecordQuery,
  SameDayWarningQuery,
  SameDayWarningResponse,
  SaveVisitRecordInput,
  SetHomeCareEndInput,
  UpdateHomeCareFeeScheduleInput,
  UpdateOrganizationInput,
  UpdateRecipientInput,
  UpdateUserInput,
  UpdateVisitFormsInput,
  UpdateVisitInput,
  UserListQuery,
  UserSummary,
  UsualDurationsQuery,
  UsualDurationsResponse,
  VisitCalendarQuery,
  VisitCalendarResponse,
  VisitDetail,
  VisitRecordVersionDetail,
  VisitRecordVersionSummary,
  VisitDictation,
  VisitDictationResponse,
  VisitListQuery,
  VisitListResponse,
} from "@repo/shared-types";
import type { KyInstance, ResponsePromise } from "ky";
import { withTimeout } from "./http.js";

/** 음성인식 + LLM 초안까지 기다린다(보통 10~30초). */
const DICTATION_TIMEOUT_MS = 180_000;

/**
 * 조회 조건 객체 → 쿼리스트링. undefined·null·""는 빼고 숫자는 문자열로 바꾼다.
 * 배열은 같은 이름을 여러 번 적는다(status=SCHEDULED&status=DRAFT).
 */
function toSearchParams(query?: object): URLSearchParams | undefined {
  if (!query) return undefined;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null || item === "") continue;
      params.append(key, String(item));
    }
  }
  return params;
}

/** 서버가 만든 파일과 그 이름(Content-Disposition 의 filename*). */
export interface FileDownload {
  blob: Blob;
  filename: string;
}

async function fileDownload(request: ResponsePromise): Promise<FileDownload> {
  const response = await request;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(
    response.headers.get("content-disposition") ?? "",
  )?.[1];
  return {
    blob: await response.blob(),
    filename: encoded ? decodeURIComponent(encoded) : "download",
  };
}

export function createCarenoteApi(http: KyInstance) {
  return {
    auth: {
      login: (input: LoginInput) =>
        http.post("auth/login", { json: input }).json<AuthResponse>(),
      logout: () => http.post("auth/logout").json<{ ok: true }>(),
      me: () => http.get("auth/me").json<AuthUser>(),
      /** 본인 비밀번호 바꾸기. 지금 비밀번호가 틀리면 400이다. 이 기기의 로그인은 유지된다. */
      changePassword: (input: ChangePasswordInput) =>
        http.post("auth/password", { json: input }).json<{ ok: true }>(),
    },

    organizations: {
      list: () => http.get("organizations").json<Organization[]>(),
      create: (input: CreateOrganizationInput) =>
        http.post("organizations", { json: input }).json<Organization>(),
      update: (id: string, input: UpdateOrganizationInput) =>
        http.patch(`organizations/${id}`, { json: input }).json<Organization>(),
    },

    /** 접속기록(기관 관리자는 자기 기관, 운영자는 전체). 보고 내려받는 것도 기록된다. */
    accessLogs: {
      list: (query: AccessLogQuery) =>
        http
          .get("access-logs", { searchParams: toSearchParams(query) })
          .json<AccessLogPage>(),
      export: (query: AccessLogQuery) =>
        fileDownload(
          http.get("access-logs/export", {
            searchParams: toSearchParams(query),
          }),
        ),
    },

    /** 재택의료 수입의 수가 묶음(보기는 기관 관리자·운영자, 넣기·고치기·지우기는 운영자). 바꾸면 목록 전체를 준다. */
    feeSchedules: {
      list: () =>
        http.get("home-care-fee-schedules").json<HomeCareFeeScheduleList>(),
      create: (input: CreateHomeCareFeeScheduleInput) =>
        http
          .post("home-care-fee-schedules", { json: input })
          .json<HomeCareFeeScheduleList>(),
      update: (id: string, input: UpdateHomeCareFeeScheduleInput) =>
        http
          .put(`home-care-fee-schedules/${id}`, { json: input })
          .json<HomeCareFeeScheduleList>(),
      remove: (id: string) =>
        http
          .delete(`home-care-fee-schedules/${id}`)
          .json<HomeCareFeeScheduleList>(),
    },

    /** 원본 서식 조정(운영자). */
    formLayouts: {
      list: () => http.get("form-layouts").json<FormLayoutSummary[]>(),
      get: (formId: string) =>
        http.get(`form-layouts/${formId}`).json<FormLayoutDetail>(),
      save: (formId: string, input: SaveFormLayoutInput) =>
        http
          .put(`form-layouts/${formId}`, { json: input })
          .json<FormLayoutDetail>(),
      reset: (formId: string) =>
        http.delete(`form-layouts/${formId}`).json<FormLayoutDetail>(),
      /** 저장하지 않은 조정으로 그린 표본 PDF. signal 로 지난 요청을 멈춘다. */
      preview: (
        formId: string,
        input: PreviewFormLayoutInput,
        signal?: AbortSignal,
      ) =>
        http
          .post(`form-layouts/${formId}/preview`, { json: input, signal })
          .blob(),
    },

    users: {
      list: (query?: UserListQuery) =>
        http
          .get("users", { searchParams: toSearchParams(query) })
          .json<UserSummary[]>(),
      create: (input: CreateUserInput) =>
        http.post("users", { json: input }).json<UserSummary>(),
      update: (id: string, input: UpdateUserInput) =>
        http.patch(`users/${id}`, { json: input }).json<UserSummary>(),
    },

    recipients: {
      list: (query?: RecipientListQuery) =>
        http
          .get("recipients", { searchParams: toSearchParams(query) })
          .json<Recipient[]>(),
      get: (id: string) => http.get(`recipients/${id}`).json<Recipient>(),
      create: (input: CreateRecipientInput) =>
        http.post("recipients", { json: input }).json<Recipient>(),
      update: (id: string, input: UpdateRecipientInput) =>
        http.patch(`recipients/${id}`, { json: input }).json<Recipient>(),
      /** 지난 기록(최신순): 같은 기관의 확정 기록과 본인의 작성 중 기록. */
      records: (id: string, query?: RecipientRecordQuery) =>
        http
          .get(`recipients/${id}/records`, {
            searchParams: toSearchParams(query),
          })
          .json<RecipientRecordPage>(),
      /** 제7호 월간 기록지 PDF(기관 관리자·운영자). */
      nurseMonthPdf: (id: string, query: NurseMonthPdfQuery) =>
        fileDownload(
          http.get(`recipients/${id}/home-care-nurse-pdf`, {
            searchParams: toSearchParams(query),
          }),
        ),
      /** 재택의료 사례 정보(포괄평가·다른 기관 서비스·종결). 바꾸는 요청도 모두 사례 정보 전체를 준다. */
      homeCareCase: (id: string) =>
        http.get(`recipients/${id}/home-care-case`).json<HomeCareCase>(),
      addAssessment: (id: string, input: CreateHomeCareAssessmentInput) =>
        http
          .post(`recipients/${id}/assessments`, { json: input })
          .json<HomeCareCase>(),
      removeAssessment: (id: string, assessmentId: string) =>
        http
          .delete(`recipients/${id}/assessments/${assessmentId}`)
          .json<HomeCareCase>(),
      addExternalService: (id: string, input: ExternalServiceInput) =>
        http
          .post(`recipients/${id}/external-services`, { json: input })
          .json<HomeCareCase>(),
      updateExternalService: (
        id: string,
        serviceId: string,
        input: ExternalServiceInput,
      ) =>
        http
          .put(`recipients/${id}/external-services/${serviceId}`, {
            json: input,
          })
          .json<HomeCareCase>(),
      removeExternalService: (id: string, serviceId: string) =>
        http
          .delete(`recipients/${id}/external-services/${serviceId}`)
          .json<HomeCareCase>(),
      setHomeCareEnd: (id: string, input: SetHomeCareEndInput) =>
        http
          .put(`recipients/${id}/home-care-end`, { json: input })
          .json<HomeCareCase>(),
    },

    visits: {
      /** 페이지 단위 목록. total·statusCounts는 조건 전체 기준이다. */
      list: (query?: VisitListQuery) =>
        http
          .get("visits", { searchParams: toSearchParams(query) })
          .json<VisitListResponse>(),
      get: (id: string) => http.get(`visits/${id}`).json<VisitDetail>(),
      /** 기간 안의 날짜별 상태 건수(달력 한 장, 최대 42일). 필터는 목록과 같다. */
      calendar: (query: VisitCalendarQuery) =>
        http
          .get("visits/calendar", { searchParams: toSearchParams(query) })
          .json<VisitCalendarResponse>(),
      /** 그날 본인 방문의 평소 방문 시간(분, 같은 수급자의 확정 기록 중앙값 — 동선 1단계). */
      usualDurations: (query: UsualDurationsQuery) =>
        http
          .get("visits/usual-durations", {
            searchParams: toSearchParams(query),
          })
          .json<UsualDurationsResponse>(),
      /** 만들려는 방문과 같은 날 함께 있으면 재택의료 급여를 산정하지 않는 방문이 있는지. */
      sameDayWarnings: (query: SameDayWarningQuery) =>
        http
          .get("visits/same-day-warnings", {
            searchParams: toSearchParams(query),
          })
          .json<SameDayWarningResponse>(),
      create: (input: CreateVisitInput) =>
        http.post("visits", { json: input }).json<VisitDetail>(),
      /**
       * 방문 일정·담당자 바꾸기(기관 관리자·운영자). 확정 방문은 일정을,
       * 기록을 쓰기 시작한 방문은 담당자를 바꿀 수 없다(409).
       */
      update: (id: string, input: UpdateVisitInput) =>
        http.patch(`visits/${id}`, { json: input }).json<VisitDetail>(),
      /** 기록 초안 저장. 확정된 방문은 409를 돌려준다. */
      saveRecord: (id: string, input: SaveVisitRecordInput) =>
        http.put(`visits/${id}/record`, { json: input }).json<VisitDetail>(),
      /** 확정 전 선택 서식 켜고 끄기. 뺀 서식에 저장한 값은 지워진다. */
      updateForms: (id: string, input: UpdateVisitFormsInput) =>
        http.put(`visits/${id}/forms`, { json: input }).json<VisitDetail>(),
      confirm: (id: string) =>
        http.post(`visits/${id}/confirm`).json<VisitDetail>(),
      /** 확정한 기록을 작성 중으로 되돌린다(담당자 본인). 고친 뒤 다시 확정한다. */
      reopen: (id: string) =>
        http.post(`visits/${id}/reopen`).json<VisitDetail>(),
      /** 확정본 이력(1차, 2차 …, 요약만) */
      versions: (id: string) =>
        http.get(`visits/${id}/versions`).json<VisitRecordVersionSummary[]>(),
      /** 확정본 한 벌(1차, 2차 …): 보관한 기록 값과 위변조 확인 */
      version: (id: string, version: number) =>
        http
          .get(`visits/${id}/versions/${version}`)
          .json<VisitRecordVersionDetail>(),
      /** 확정본 한 벌의 서식 PDF(style: 원본 위에 채움 / 표준 서식). */
      versionPdf: (id: string, version: number, query: FormPdfQuery) =>
        fileDownload(
          http.get(`visits/${id}/versions/${version}/pdf`, {
            searchParams: toSearchParams(query),
          }),
        ),
      /** 예정 상태의 방문만 지울 수 있다. */
      remove: (id: string) => http.delete(`visits/${id}`).json<{ ok: true }>(),
      /** 재택의료 수입: 그달 재택의료센터 방문(금액 셈에 쓰는 사실)과 수급자별 직전 연속 개월 */
      homeCareMonth: (query: HomeCareMonthQuery) =>
        http
          .get("visits/home-care-month", {
            searchParams: toSearchParams(query),
          })
          .json<HomeCareMonthResponse>(),
      /** 확정했지만 포털에 넣었다고 표시하지 않은 서식(기본: 지난달 1일부터 오늘까지) */
      portalQueue: (query?: PortalQueueQuery) =>
        http
          .get("visits/portal-queue", { searchParams: toSearchParams(query) })
          .json<PortalQueueResponse>(),
      /** 방문 서식의 포털 입력 표시 */
      portalEntries: (id: string) =>
        http.get(`visits/${id}/portal-entries`).json<PortalEntry[]>(),
      /** 확정한 서식을 포털에 넣었다고 표시(다시 누르면 시각·메모를 새로) */
      markPortalEntry: (
        id: string,
        formId: FormId,
        input: MarkPortalEntryInput,
      ) =>
        http
          .put(`visits/${id}/portal-entries/${formId}`, { json: input })
          .json<PortalEntry[]>(),
      /** 포털 입력 표시 지우기 */
      unmarkPortalEntry: (id: string, formId: FormId) =>
        http
          .delete(`visits/${id}/portal-entries/${formId}`)
          .json<PortalEntry[]>(),
    },

    /** 방문 직후 음성 구술 → 기록 초안. 담당 간호사만, 확정 전까지. */
    dictation: {
      get: (visitId: string) =>
        http.get(`visits/${visitId}/dictation`).json<VisitDictationResponse>(),
      /**
       * 녹음(16kHz·모노·16비트 WAV)을 올려 음성인식·초안을 만든다.
       * append면 이전 구술 뒤에 이어 붙이고(되묻기 답), 아니면 이전 구술을 바꾼다.
       */
      record: (
        visitId: string,
        audio: Blob,
        { append }: { append: boolean },
      ) => {
        const form = new FormData();
        form.append("audio", audio, "dictation.wav");
        form.append("append", String(append));
        return http
          .post(`visits/${visitId}/dictation`, {
            body: form,
            ...withTimeout(DICTATION_TIMEOUT_MS),
          })
          .json<VisitDictation>();
      },
      /** 저장된 문장으로 초안만 다시 만든다. */
      redraft: (visitId: string) =>
        http
          .post(
            `visits/${visitId}/dictation/redraft`,
            withTimeout(DICTATION_TIMEOUT_MS),
          )
          .json<VisitDictation>(),
      remove: (visitId: string) =>
        http.delete(`visits/${visitId}/dictation`).json<{ ok: true }>(),
    },
  };
}

export type CarenoteApi = ReturnType<typeof createCarenoteApi>;
