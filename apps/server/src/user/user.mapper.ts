import type { AuthUser, UserSummary } from "@repo/shared-types";
import type { Prisma } from "../generated/prisma/client.js";

/** 사용자 응답(UserSummary·AuthUser)에 필요한 컬럼. */
export const userSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  profession: true,
  licenseNumber: true,
  isActive: true,
  organizationId: true,
  createdAt: true,
  organization: { select: { name: true, programs: true } },
} as const satisfies Prisma.UserSelect;

export type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    profession: row.profession,
    organizationId: row.organizationId,
    organizationName: row.organization?.name ?? null,
    programs: row.organization?.programs ?? [],
  };
}

export function toUserSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    profession: row.profession,
    licenseNumber: row.licenseNumber,
    organizationId: row.organizationId,
    organizationName: row.organization?.name ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}
