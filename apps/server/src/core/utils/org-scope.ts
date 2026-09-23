import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user.js";

/** 기관 소속이 필요한 작업에서 소속 기관 id를 돌려준다. */
export function requireOrganizationId(user: AuthenticatedUser): string {
  if (!user.organizationId) {
    throw new ForbiddenException("소속 기관이 없는 계정입니다");
  }
  return user.organizationId;
}

/**
 * 목록 조회의 기관 범위.
 * 운영자(ADMIN)는 요청한 기관(없으면 전체), 그 외는 항상 자기 기관으로 고정한다.
 */
export function resolveOrganizationFilter(
  user: AuthenticatedUser,
  requested?: string | null,
): string | undefined {
  if (user.role === "ADMIN") return requested ?? undefined;
  return requireOrganizationId(user);
}

/**
 * 새로 만드는 대상(사용자·수급자)의 소속 기관.
 * 운영자는 요청한 기관, 그 외는 자기 기관으로 고정한다. `required`인데 없으면 400.
 * 기관이 실제로 있는지는 저장할 때 외래 키가 확인한다(P2003 → 404).
 */
export function resolveTargetOrganizationId(
  actor: AuthenticatedUser,
  requested: string | null | undefined,
): string;
export function resolveTargetOrganizationId(
  actor: AuthenticatedUser,
  requested: string | null | undefined,
  required: boolean,
): string | null;
export function resolveTargetOrganizationId(
  actor: AuthenticatedUser,
  requested: string | null | undefined,
  required = true,
): string | null {
  if (!required) return null;
  const organizationId =
    actor.role === "ADMIN" ? requested : requireOrganizationId(actor);
  if (!organizationId) {
    throw new BadRequestException("기관을 선택해 주세요");
  }
  return organizationId;
}

/**
 * 단건 접근 시 대상이 사용자의 기관 범위 안인지 확인한다.
 * 다른 기관 데이터의 존재 여부를 드러내지 않도록 403 대신 404로 응답한다.
 */
export function assertOrganizationAccess(
  user: AuthenticatedUser,
  organizationId: string | null,
  notFoundMessage: string,
): void {
  if (user.role === "ADMIN") return;
  if (user.organizationId !== organizationId) {
    throw new NotFoundException(notFoundMessage);
  }
}
