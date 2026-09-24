import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  checkRecipientPrograms,
  PROGRAM_LABELS,
  type CreateRecipientSchema,
  type Program,
  type Recipient,
  type RecipientListQuery,
  type UpdateRecipientSchema,
} from "@repo/shared-types";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import {
  assertOrganizationAccess,
  resolveOrganizationFilter,
  resolveTargetOrganizationId,
} from "../core/utils/org-scope.js";
import { handlePrismaError, PrismaService } from "../prisma/index.js";
import { toCareGrade, toDbDate, toRecipient } from "./recipient.mapper.js";

type CreateRecipientData = z.output<typeof CreateRecipientSchema>;
type UpdateRecipientData = z.output<typeof UpdateRecipientSchema>;

const RECIPIENT_NOT_FOUND = "수급자를 찾을 수 없습니다";
const ORGANIZATION_NOT_FOUND = "기관을 찾을 수 없습니다";

/** 등록 사업은 기관이 하는 사업 안에서만 고른다. */
function assertOrganizationPrograms(
  programs: readonly Program[],
  organizationPrograms: readonly Program[],
): void {
  const outside = programs.find((p) => !organizationPrograms.includes(p));
  if (outside) {
    throw new BadRequestException(
      `이 기관은 ${PROGRAM_LABELS[outside]} 사업을 하지 않습니다. 기관 사업을 먼저 설정해 주세요`,
    );
  }
}

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
    const targetId = resolveTargetOrganizationId(actor, organizationId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: targetId },
      select: { programs: true },
    });
    if (!organization) throw new NotFoundException(ORGANIZATION_NOT_FOUND);
    assertOrganizationPrograms(fields.programs, organization.programs);

    try {
      const row = await this.prisma.recipient.create({
        data: {
          ...fields,
          birthDate: toDbDate(birthDate),
          organizationId: targetId,
        },
      });
      return toRecipient(row);
    } catch (error) {
      handlePrismaError(error, { foreignKey: ORGANIZATION_NOT_FOUND });
    }
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    { birthDate, ...fields }: UpdateRecipientData,
  ): Promise<Recipient> {
    if (fields.programs !== undefined || fields.careGrade !== undefined) {
      await this.assertProgramsFit(actor, id, fields);
    }
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

  /**
   * 등록 사업·장기요양등급 중 한쪽만 바꾸는 요청도 있으므로 저장된 값과 합친 뒤
   * 스키마와 같은 규칙(checkRecipientPrograms)과 기관 사업 범위를 확인한다.
   */
  private async assertProgramsFit(
    actor: AuthenticatedUser,
    id: string,
    fields: Pick<UpdateRecipientData, "programs" | "careGrade">,
  ): Promise<void> {
    const current = await this.prisma.recipient.findFirst({
      where: { id, organizationId: resolveOrganizationFilter(actor) },
      select: {
        programs: true,
        careGrade: true,
        organization: { select: { programs: true } },
      },
    });
    if (!current) throw new NotFoundException(RECIPIENT_NOT_FOUND);
    const programs = fields.programs ?? current.programs;
    const careGrade =
      fields.careGrade === undefined
        ? toCareGrade(current.careGrade)
        : fields.careGrade;
    const message = checkRecipientPrograms(programs, careGrade);
    if (message) throw new BadRequestException(message);
    assertOrganizationPrograms(programs, current.organization.programs);
  }
}
