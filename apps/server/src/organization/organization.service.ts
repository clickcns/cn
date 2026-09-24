import { Injectable } from "@nestjs/common";
import type {
  CreateOrganizationSchema,
  Organization,
  UpdateOrganizationSchema,
} from "@repo/shared-types";
import type { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { handlePrismaError, PrismaService } from "../prisma/index.js";

const organizationInclude = {
  _count: { select: { users: true, recipients: true } },
} as const satisfies Prisma.OrganizationInclude;

type OrganizationRow = Prisma.OrganizationGetPayload<{
  include: typeof organizationInclude;
}>;

const PRISMA_MESSAGES = {
  conflict: "이미 사용 중인 기관 코드입니다",
  notFound: "기관을 찾을 수 없습니다",
};

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    programs: row.programs,
    userCount: row._count.users,
    recipientCount: row._count.recipients,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Organization[]> {
    const rows = await this.prisma.organization.findMany({
      include: organizationInclude,
      orderBy: { name: "asc" },
    });
    return rows.map(toOrganization);
  }

  async create(
    dto: z.output<typeof CreateOrganizationSchema>,
  ): Promise<Organization> {
    try {
      const row = await this.prisma.organization.create({
        data: dto,
        include: organizationInclude,
      });
      return toOrganization(row);
    } catch (error) {
      handlePrismaError(error, PRISMA_MESSAGES);
    }
  }

  async update(
    id: string,
    dto: z.output<typeof UpdateOrganizationSchema>,
  ): Promise<Organization> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.organization.update({
          where: { id },
          data: dto,
          include: organizationInclude,
        });
        if (dto.programs) {
          // 수급자 등록 사업은 기관 사업의 부분집합이다. 기관이 그만둔 사업은 수급자에게서도 뺀다.
          await tx.$executeRaw`
            UPDATE recipients
            SET programs = ARRAY(
                  SELECT p FROM unnest(programs) AS p
                  WHERE p = ANY(${dto.programs}::"Program"[])
                ),
                "updatedAt" = now()
            WHERE "organizationId" = ${id}
              AND NOT (programs <@ ${dto.programs}::"Program"[])`;
        }
        return updated;
      });
      return toOrganization(row);
    } catch (error) {
      handlePrismaError(error, PRISMA_MESSAGES);
    }
  }
}
