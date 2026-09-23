import type {
  AuthResponse,
  AuthUser,
  CreateOrganizationInput,
  CreateRecipientInput,
  CreateUserInput,
  CreateVisitInput,
  LoginInput,
  Organization,
  Recipient,
  RecipientListQuery,
  SaveVisitRecordInput,
  UpdateOrganizationInput,
  UpdateRecipientInput,
  UpdateUserInput,
  UserListQuery,
  UserSummary,
  VisitDetail,
  VisitDictation,
  VisitDictationResponse,
  VisitListQuery,
  VisitListResponse,
} from "@repo/shared-types";
import type { KyInstance } from "ky";
import { withTimeout } from "./http.js";

/** 음성인식 + LLM 초안까지 기다린다(보통 10~30초). */
const DICTATION_TIMEOUT_MS = 180_000;

/** 조회 조건 객체 → 쿼리스트링. undefined·null·""는 빼고 숫자는 문자열로 바꾼다. */
function toSearchParams(query?: object): URLSearchParams | undefined {
  if (!query) return undefined;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params;
}

export function createCarenoteApi(http: KyInstance) {
  return {
    auth: {
      login: (input: LoginInput) =>
        http.post("auth/login", { json: input }).json<AuthResponse>(),
      logout: () => http.post("auth/logout").json<{ ok: true }>(),
      me: () => http.get("auth/me").json<AuthUser>(),
    },

    organizations: {
      list: () => http.get("organizations").json<Organization[]>(),
      create: (input: CreateOrganizationInput) =>
        http.post("organizations", { json: input }).json<Organization>(),
      update: (id: string, input: UpdateOrganizationInput) =>
        http.patch(`organizations/${id}`, { json: input }).json<Organization>(),
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
    },

    visits: {
      /** 페이지 단위 목록. total·statusCounts는 조건 전체 기준이다. */
      list: (query?: VisitListQuery) =>
        http
          .get("visits", { searchParams: toSearchParams(query) })
          .json<VisitListResponse>(),
      get: (id: string) => http.get(`visits/${id}`).json<VisitDetail>(),
      create: (input: CreateVisitInput) =>
        http.post("visits", { json: input }).json<VisitDetail>(),
      /** 기록 초안 저장. 확정된 방문은 409를 돌려준다. */
      saveRecord: (id: string, input: SaveVisitRecordInput) =>
        http.put(`visits/${id}/record`, { json: input }).json<VisitDetail>(),
      confirm: (id: string) =>
        http.post(`visits/${id}/confirm`).json<VisitDetail>(),
      /** 예정 상태의 방문만 지울 수 있다. */
      remove: (id: string) => http.delete(`visits/${id}`).json<{ ok: true }>(),
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
