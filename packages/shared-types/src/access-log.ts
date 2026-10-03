import { z } from "zod";
import type { Role } from "./roles.js";

/*
 * 접속기록(개인정보의 안전성 확보조치 기준 제8조): 누가(계정) 언제(일시) 어디서(접속지) 어떤 정보주체의
 * 정보를 어떻게(수행 업무) 처리했는지. 서버가 API마다 남기고(접속기록 인터셉터), 고칠 수 없으며 3년이
 * 지난 행만 지울 수 있다. 사용자 등록·권한 변경(제5조 권한 기록)도 같은 표에 "권한 변경"으로 남긴다.
 */

export const ACCESS_ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "VIEW",
  "CREATE",
  "UPDATE",
  "DELETE",
  "DOWNLOAD",
  "PERMISSION",
] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export const ACCESS_ACTION_LABELS: Record<AccessAction, string> = {
  LOGIN: "로그인",
  LOGIN_FAILED: "로그인 실패",
  LOGOUT: "로그아웃",
  VIEW: "조회",
  CREATE: "등록",
  UPDATE: "수정",
  DELETE: "삭제",
  DOWNLOAD: "내려받기",
  PERMISSION: "권한 변경",
};

/** 처리한 대상의 종류(정보주체는 따로 recipients). */
export const ACCESS_TARGET_TYPES = [
  "visit",
  "recipient",
  "user",
  "organization",
] as const;
export type AccessTargetType = (typeof ACCESS_TARGET_TYPES)[number];

/** 한 줄에 남기는 정보주체(수급자) 수의 상한. 목록은 그 수(subjectCount)만 정확히 남긴다. */
export const ACCESS_LOG_MAX_SUBJECTS = 500;
export const ACCESS_LOG_MAX_PAGE_SIZE = 100;
/** 내려받기(CSV) 한 번의 상한 */
export const ACCESS_LOG_EXPORT_MAX_ROWS = 10_000;

/** 기록에 값을 남기지 않는 요청 칸(비밀번호·기록 내용 등). 칸 이름만 남긴다. */
const SECRET_KEYS = new Set(["password", "currentPassword", "newPassword"]);

/** 요청 본문에서 바꾼 칸 이름만(값은 남기지 않는다 — 기록 내용·비밀번호가 접속기록에 남지 않게). */
export function changedFieldNames(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.keys(body)
    .filter((key) => (body as Record<string, unknown>)[key] !== undefined)
    .sort();
}

/** 검색 조건(쿼리스트링)에서 빈 값과 비밀 칸을 뺀다. */
export function searchConditions(
  query: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([key, value]) =>
        !SECRET_KEYS.has(key) &&
        value !== undefined &&
        value !== null &&
        value !== "",
    ),
  );
}

/** 정보주체 id 목록: 빈 값과 겹침을 빼고 상한까지. */
export function accessSubjects(ids: readonly (string | null | undefined)[]): {
  ids: string[];
  count: number;
} {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  return {
    ids: unique.slice(0, ACCESS_LOG_MAX_SUBJECTS),
    count: unique.length,
  };
}

export const AccessLogQuerySchema = z
  .object({
    from: z.iso.date("시작일을 YYYY-MM-DD로 적어 주세요"),
    to: z.iso.date("종료일을 YYYY-MM-DD로 적어 주세요"),
    action: z.enum(ACCESS_ACTIONS).optional(),
    actorId: z.uuid().optional(),
    recipientId: z.uuid().optional(),
    /** 실패한 요청만(응답 400 이상) */
    failedOnly: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    organizationId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(ACCESS_LOG_MAX_PAGE_SIZE)
      .default(50),
  })
  .refine((query) => query.from <= query.to, {
    message: "시작일이 종료일보다 늦습니다",
    path: ["to"],
  });
export type AccessLogQuery = z.input<typeof AccessLogQuerySchema>;

export interface AccessLogEntry {
  id: string;
  at: string;
  actor: {
    id: string | null;
    username: string;
    name: string | null;
    role: Role | null;
  };
  action: AccessAction;
  /** 작업 이름(예: "방문 기록 확정") */
  label: string;
  target: {
    type: AccessTargetType;
    id: string;
    /** 사용자·기관 이름(방문·수급자는 recipients로 본다) */
    name: string | null;
  } | null;
  /** 처리한 정보주체(지금 이름, 찾지 못하면 null) */
  recipients: { id: string; name: string | null }[];
  /** 목록에 나온 정보주체 수(recipients는 그중 앞쪽만) */
  subjectCount: number;
  ip: string;
  method: string;
  path: string;
  status: number;
  detail: Record<string, unknown> | null;
}

export interface AccessLogPage {
  items: AccessLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** 화면·CSV에 이름을 보이는 정보주체 수(나머지는 "외 n명"). 조회 API도 이만큼만 보낸다 */
export const ACCESS_LOG_SHOWN_SUBJECTS = 3;

/** 정보주체 앞쪽 몇 명과 나머지 수(표·CSV가 함께 쓴다). */
export function accessSubjectsShown(
  entry: Pick<AccessLogEntry, "recipients" | "subjectCount">,
): { shown: AccessLogEntry["recipients"]; more: number } {
  const shown = entry.recipients.slice(0, ACCESS_LOG_SHOWN_SUBJECTS);
  return { shown, more: Math.max(entry.subjectCount - shown.length, 0) };
}

/** 표·CSV에 쓰는 대상 글: 정보주체 이름(많으면 "외 n명"), 없으면 사용자·기관 이름. */
export function accessTargetText(
  entry: Pick<AccessLogEntry, "recipients" | "subjectCount" | "target">,
): string {
  const { shown, more } = accessSubjectsShown(entry);
  if (shown.length === 0) {
    return more > 0 ? `${more}명` : (entry.target?.name ?? "");
  }
  const names = shown
    .map((recipient) => recipient.name ?? "(알 수 없음)")
    .join(", ");
  return more > 0 ? `${names} 외 ${more}명` : names;
}
