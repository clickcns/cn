import {
  changedFieldNames,
  kstDateRange,
  LoginSchema,
  searchConditions,
  type AccessLogQuerySchema,
  type AccessTargetType,
  type Role,
  type UserSummary,
} from "@repo/shared-types";
import type { Request } from "express";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { resolveOrganizationFilter } from "../core/utils/org-scope.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { AccessLogSpec } from "./access-log.decorator.js";

/** 권한 기록(제5조)에 남기는 사용자 권한 칸 */
const PERMISSION_KEYS = [
  "role",
  "profession",
  "organizationId",
  "isActive",
] as const;
export type PermissionValues = Pick<
  UserSummary,
  (typeof PERMISSION_KEYS)[number]
>;

/** 대상 하나와 그 정보주체·기관(찾지 못하면 빈 값). */
export interface ResolvedTarget {
  type: AccessTargetType;
  id: string | null;
  recipientIds: string[];
  organizationId: string | null;
  /** 사용자 대상이면 바꾸기 전 권한(권한 기록의 이전 값) */
  before: PermissionValues | null;
}

/** 응답이 끝났을 때의 결과: 상태, 핸들러가 돌려준 값, 오류 문구(에러 필터가 보낸 것). */
export interface AccessOutcome {
  status: number;
  result?: unknown;
  error?: string;
}

export interface AccessActor {
  id: string | null;
  username: string;
  name: string | null;
  role: Role | null;
  organizationId: string | null;
}

/**
 * 처리한 사람: 로그인한 사용자, 로그인 요청이면 응답의 사용자, 로그인 실패면 입력한 아이디만(로그인과
 * 같은 규칙으로 다듬는다).
 */
export function accessActor(request: Request, result: unknown): AccessActor {
  const authenticated = request.user as AuthenticatedUser | undefined;
  const known =
    (authenticated && "username" in authenticated ? authenticated : null) ??
    (result as { user?: AccessActor } | undefined)?.user;
  if (known) {
    return {
      id: known.id,
      username: known.username,
      name: known.name,
      role: known.role,
      organizationId: known.organizationId,
    };
  }
  const typed = LoginSchema.shape.username.safeParse(
    (request.body as { username?: unknown } | undefined)?.username,
  );
  return {
    id: null,
    username: typed.success ? typed.data.slice(0, 100) : "(입력 없음)",
    name: null,
    role: null,
    organizationId: null,
  };
}

/** 경로 값 `:id` */
export function paramId(request: Request): string | null {
  const id = request.params?.id;
  return typeof id === "string" && id ? id : null;
}

/** 응답의 id(새로 만든 대상) */
export function resultId(result: unknown): string | null {
  const id = (result as { id?: unknown } | undefined)?.id;
  return typeof id === "string" && id ? id : null;
}

/** 목록 등 대상이 없는 기록의 기관: 운영자는 요청한 기관(없으면 null), 그 외는 자기 기관. */
export function scopeOrganizationId(
  actor: AccessActor,
  request: Request,
): string | null {
  if (actor.role === "ADMIN") {
    const requested = (request.query as { organizationId?: unknown })
      ?.organizationId;
    return typeof requested === "string" && requested ? requested : null;
  }
  return actor.organizationId;
}

/** 권한 기록: 바뀐 권한 칸의 이전·새 값(새로 만들면 이전 값은 없다). */
export function permissionChanges(
  before: PermissionValues | null,
  after: unknown,
): Record<string, { before: unknown; after: unknown }> {
  if (!after || typeof after !== "object") return {};
  const next = after as Partial<PermissionValues>;
  return Object.fromEntries(
    PERMISSION_KEYS.filter(
      (key) => next[key] !== undefined && next[key] !== before?.[key],
    ).map((key) => [key, { before: before?.[key] ?? null, after: next[key] }]),
  );
}

/** 기본 상세: 경로 값(id 빼고 — 대상에 따로 남긴다)과, 조회는 검색 조건·바꾸는 요청은 바꾼 칸 이름. */
function defaultDetail(request: Request): Record<string, unknown> {
  const params = Object.fromEntries(
    Object.entries(request.params ?? {}).filter(([key]) => key !== "id"),
  );
  return {
    ...params,
    ...(request.method === "GET"
      ? searchConditions(request.query ?? {})
      : { fields: changedFieldNames(request.body) }),
  };
}

/**
 * 접속기록 한 줄(순수 함수). 대상·정보주체·기관은 서비스가 찾아 넘긴다. 실패한 로그인은 LOGIN_FAILED,
 * 권한 변경이 성공하면 바뀐 권한의 이전·새 값, 실패하면 오류 문구를 상세에 더한다.
 */
export function buildAccessLog(
  spec: AccessLogSpec,
  request: Request,
  outcome: AccessOutcome,
  resolved: {
    actor: AccessActor;
    target: ResolvedTarget | null;
    subjects: { ids: string[]; count: number };
    organizationIds: string[];
  },
): Prisma.AccessLogCreateInput {
  const { actor, target, subjects } = resolved;
  const failed = outcome.status >= 400;
  const detail: Record<string, unknown> = spec.detail?.(request) ?? {
    ...defaultDetail(request),
  };
  if (spec.action === "PERMISSION" && !failed && target) {
    const changes = permissionChanges(target.before, outcome.result);
    if (Object.keys(changes).length > 0) detail.changes = changes;
  }
  if (failed && outcome.error) detail.error = outcome.error;
  const hasDetail = Object.values(detail).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined,
  );

  return {
    actorId: actor.id,
    actorUsername: actor.username,
    actorName: actor.name,
    actorRole: actor.role,
    organizationIds: resolved.organizationIds,
    ip: request.ip ?? "",
    action: spec.action === "LOGIN" && failed ? "LOGIN_FAILED" : spec.action,
    label: spec.label,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    recipientIds: subjects.ids,
    subjectCount: subjects.count,
    method: request.method,
    path:
      (request.route as { path?: string } | undefined)?.path ?? request.path,
    status: outcome.status,
    detail: hasDetail ? (detail as Prisma.InputJsonValue) : undefined,
  };
}

/** 조회 조건: 기간(한국 날짜, 끝 포함)·작업·사용자·정보주체·실패만. 기관 관리자는 자기 기관 기록만. */
export function accessLogWhere(
  actor: AuthenticatedUser,
  query: z.output<typeof AccessLogQuerySchema>,
): Prisma.AccessLogWhereInput {
  const organizationId = resolveOrganizationFilter(actor, query.organizationId);
  return {
    at: kstDateRange(query.from, query.to),
    ...(organizationId ? { organizationIds: { has: organizationId } } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.recipientId ? { recipientIds: { has: query.recipientId } } : {}),
    ...(query.failedOnly ? { status: { gte: 400 } } : {}),
  };
}
