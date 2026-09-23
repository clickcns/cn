import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  allowsProfession,
  assignableRoles,
  requiresOrganization,
  requiresProfession,
  type CreateUserSchema,
  type UpdateUserSchema,
  type UserListQuery,
  type UserSummary,
} from "@repo/shared-types";
import * as bcrypt from "bcryptjs";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import {
  assertOrganizationAccess,
  resolveOrganizationFilter,
  resolveTargetOrganizationId,
} from "../core/utils/org-scope.js";
import { handlePrismaError, PrismaService } from "../prisma/index.js";
import { toUserSummary, userSelect } from "./user.mapper.js";

type CreateUserData = z.output<typeof CreateUserSchema>;
type UpdateUserData = z.output<typeof UpdateUserSchema>;

const BCRYPT_ROUNDS = 10;
const USER_NOT_FOUND = "사용자를 찾을 수 없습니다";
const PRISMA_MESSAGES = {
  conflict: "이미 사용 중인 아이디입니다",
  notFound: USER_NOT_FOUND,
  foreignKey: "기관을 찾을 수 없습니다",
};

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthenticatedUser,
    query: UserListQuery,
  ): Promise<UserSummary[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        organizationId: resolveOrganizationFilter(actor, query.organizationId),
        role: query.role,
        profession: query.profession,
      },
      select: userSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return rows.map(toUserSummary);
  }

  async create(
    actor: AuthenticatedUser,
    dto: CreateUserData,
  ): Promise<UserSummary> {
    if (!assignableRoles(actor.role).includes(dto.role)) {
      throw new ForbiddenException(
        "기관 관리자는 운영자 계정을 만들 수 없습니다",
      );
    }

    try {
      const row = await this.prisma.user.create({
        data: {
          username: dto.username,
          name: dto.name,
          role: dto.role,
          // 운영자는 직종이 없다(스키마가 현장 직원의 직종 누락은 이미 막는다).
          profession: allowsProfession(dto.role) ? dto.profession : null,
          licenseNumber: allowsProfession(dto.role) ? dto.licenseNumber : null,
          organizationId: resolveTargetOrganizationId(
            actor,
            dto.organizationId,
            requiresOrganization(dto.role),
          ),
          password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        },
        select: userSelect,
      });
      return toUserSummary(row);
    } catch (error) {
      handlePrismaError(error, PRISMA_MESSAGES);
    }
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateUserData,
  ): Promise<UserSummary> {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        profession: true,
        organizationId: true,
      },
    });
    if (!target) throw new NotFoundException(USER_NOT_FOUND);
    assertOrganizationAccess(actor, target.organizationId, USER_NOT_FOUND);

    if (actor.role !== "ADMIN") {
      const allowed = assignableRoles(actor.role);
      if (
        !allowed.includes(target.role) ||
        (dto.role && !allowed.includes(dto.role))
      ) {
        throw new ForbiddenException(
          "기관 관리자는 운영자 계정을 다룰 수 없습니다",
        );
      }
      if (dto.organizationId !== undefined) {
        throw new ForbiddenException(
          "기관 관리자는 소속 기관을 바꿀 수 없습니다",
        );
      }
    }

    if (
      target.id === actor.id &&
      (dto.isActive === false || (dto.role && dto.role !== target.role))
    ) {
      throw new BadRequestException(
        "본인 계정의 역할이나 사용 상태는 바꿀 수 없습니다",
      );
    }

    const nextRole = dto.role ?? target.role;
    const nextOrganizationId = requiresOrganization(nextRole)
      ? dto.organizationId !== undefined
        ? dto.organizationId
        : target.organizationId
      : null;
    if (requiresOrganization(nextRole) && !nextOrganizationId) {
      throw new BadRequestException("기관을 선택해 주세요");
    }

    const nextProfession = allowsProfession(nextRole)
      ? dto.profession !== undefined
        ? dto.profession
        : target.profession
      : null;
    if (requiresProfession(nextRole) && !nextProfession) {
      throw new BadRequestException("현장 직원은 직종을 선택해 주세요");
    }
    if (
      nextOrganizationId !== target.organizationId ||
      nextProfession !== target.profession
    ) {
      await this.assertNoPendingVisits(id);
    }

    // 사용 중지·비밀번호 재설정 시 기존 로그인 세션을 모두 끊는다.
    const revokeSessions = dto.isActive === false || dto.password !== undefined;
    const password = dto.password
      ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
      : undefined;

    try {
      const [row] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id },
          data: {
            name: dto.name,
            role: dto.role,
            profession: nextProfession,
            licenseNumber: allowsProfession(nextRole)
              ? dto.licenseNumber
              : null,
            isActive: dto.isActive,
            organizationId: nextOrganizationId,
            password,
          },
          select: userSelect,
        }),
        ...(revokeSessions
          ? [this.prisma.refreshSession.deleteMany({ where: { userId: id } })]
          : []),
      ]);
      return toUserSummary(row);
    } catch (error) {
      handlePrismaError(error, PRISMA_MESSAGES);
    }
  }

  /**
   * 방문은 담당자의 기관에 묶여 있고, 서식은 방문을 만들 때 담당자 직종으로 정해진다.
   * 기관이나 직종을 바꾸면 확정하지 않은 방문을 쓸 수 없게 되므로, 그런 방문이 있으면 막는다.
   */
  private async assertNoPendingVisits(userId: string): Promise<void> {
    const pending = await this.prisma.visit.count({
      where: { staffId: userId, status: { in: ["SCHEDULED", "DRAFT"] } },
    });
    if (pending > 0) {
      throw new ConflictException(
        `확정하지 않은 방문이 ${pending}건 있어 소속 기관이나 직종을 바꿀 수 없습니다. 작성 중인 방문은 확정하고, 예정 방문은 삭제한 뒤 다시 시도해 주세요`,
      );
    }
  }
}
