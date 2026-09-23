import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateRecipientSchema,
  Recipient,
  RecipientListQuery,
  UpdateRecipientSchema,
} from "@repo/shared-types";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import {
  assertOrganizationAccess,
  resolveOrganizationFilter,
  resolveTargetOrganizationId,
} from "../core/utils/org-scope.js";
import { handlePrismaError, PrismaService } from "../prisma/index.js";
import { toDbDate, toRecipient } from "./recipient.mapper.js";

type CreateRecipientData = z.output<typeof CreateRecipientSchema>;
type UpdateRecipientData = z.output<typeof UpdateRecipientSchema>;

const RECIPIENT_NOT_FOUND = "수급자를 찾을 수 없습니다";

@Injectable()
export class RecipientService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthenticatedUser,
    query: RecipientListQuery,
  ): Promise<Recipient[]> {
    const rows = await this.prisma.recipient.findMany({
      where: {
        organizationId: resolveOrganizationFilter(actor, query.organizationId),
        isActive: query.includeInactive === "true" ? undefined : true,
        name: query.q ? { contains: query.q, mode: "insensitive" } : undefined,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return rows.map(toRecipient);
  }

  async get(actor: AuthenticatedUser, id: string): Promise<Recipient> {
    const row = await this.prisma.recipient.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(RECIPIENT_NOT_FOUND);
    assertOrganizationAccess(actor, row.organizationId, RECIPIENT_NOT_FOUND);
    return toRecipient(row);
  }

  async create(
    actor: AuthenticatedUser,
    { organizationId, birthDate, ...fields }: CreateRecipientData,
  ): Promise<Recipient> {
    try {
      const row = await this.prisma.recipient.create({
        data: {
          ...fields,
          birthDate: toDbDate(birthDate),
          organizationId: resolveTargetOrganizationId(actor, organizationId),
        },
      });
      return toRecipient(row);
    } catch (error) {
      handlePrismaError(error, { foreignKey: "기관을 찾을 수 없습니다" });
    }
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    { birthDate, ...fields }: UpdateRecipientData,
  ): Promise<Recipient> {
    try {
      // 기관 범위를 where에 넣어 한 번에 갱신한다. 범위 밖이면 대상 없음(404).
      const row = await this.prisma.recipient.update({
        where: {
          id,
          organizationId: resolveOrganizationFilter(actor),
        },
        data: { ...fields, birthDate: toDbDate(birthDate) },
      });
      return toRecipient(row);
    } catch (error) {
      handlePrismaError(error, { notFound: RECIPIENT_NOT_FOUND });
    }
  }
}
