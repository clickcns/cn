import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  assessmentOrderError,
  type CreateHomeCareAssessmentSchema,
  type ExternalServiceSchema,
  type HomeCareCase,
  type SetHomeCareEndSchema,
} from "@repo/shared-types";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { toDbDate } from "../core/utils/db-date.js";
import { resolveOrganizationFilter } from "../core/utils/org-scope.js";
import { handlePrismaError, PrismaService } from "../prisma/index.js";
import {
  assessmentFactArgs,
  homeCareCaseSelect,
  toAssessmentFact,
  toHomeCareCase,
} from "./home-care-case.mapper.js";

const RECIPIENT_NOT_FOUND = "수급자를 찾을 수 없습니다";
const SERVICE_NOT_FOUND = "다른 기관 서비스를 찾을 수 없습니다";

type ExternalServiceData = z.output<typeof ExternalServiceSchema>;

/** 기관 범위 안의 수급자(다른 기관 수급자는 찾지 못한 것으로 404). */
function recipientWhere(actor: AuthenticatedUser, id: string) {
  return { id, organizationId: resolveOrganizationFilter(actor) };
}

/** 다른 기관 서비스 입력 → 저장 값(날짜 열은 @db.Date). */
function externalServiceData({
  startsOn,
  endsOn,
  ...fields
}: ExternalServiceData) {
  return {
    ...fields,
    startsOn: toDbDate(startsOn),
    endsOn: toDbDate(endsOn),
  };
}

/**
 * 재택의료센터 수급자의 사례 정보(shared-types home-care-case.ts): 포괄평가 기록, 다른 기관 서비스
 * 일정, 재택의료 종결. 기관 관리자·운영자만 다루고(컨트롤러 @Roles), 다른 기관 수급자는 404다.
 * 바꾼 뒤에는 사례 정보 전체를 돌려준다(화면이 그대로 캐시에 넣는다).
 */
@Injectable()
export class HomeCareCaseService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    actor: AuthenticatedUser,
    recipientId: string,
  ): Promise<HomeCareCase> {
    const row = await this.prisma.recipient.findFirst({
      where: recipientWhere(actor, recipientId),
      select: homeCareCaseSelect,
    });
    if (!row) throw new NotFoundException(RECIPIENT_NOT_FOUND);
    return toHomeCareCase(row);
  }

  async addAssessment(
    actor: AuthenticatedUser,
    recipientId: string,
    { assessedOn, kind, note }: z.output<typeof CreateHomeCareAssessmentSchema>,
  ): Promise<HomeCareCase> {
    const recipient = await this.prisma.recipient.findFirst({
      where: recipientWhere(actor, recipientId),
      select: { assessments: assessmentFactArgs },
    });
    if (!recipient) throw new NotFoundException(RECIPIENT_NOT_FOUND);
    const orderError = assessmentOrderError(
      recipient.assessments.map(toAssessmentFact),
      { assessedOn, kind },
    );
    if (orderError) throw new BadRequestException(orderError);
    try {
      await this.prisma.homeCareAssessment.create({
        data: {
          recipientId,
          assessedOn: toDbDate(assessedOn)!,
          kind,
          note,
          createdById: actor.id,
        },
      });
    } catch (error) {
      handlePrismaError(error, {
        conflict: "그날 포괄평가 기록이 이미 있습니다",
      });
    }
    return this.get(actor, recipientId);
  }

  async removeAssessment(
    actor: AuthenticatedUser,
    recipientId: string,
    assessmentId: string,
  ): Promise<HomeCareCase> {
    await this.assertRecipient(actor, recipientId);
    const { count } = await this.prisma.homeCareAssessment.deleteMany({
      where: { id: assessmentId, recipientId },
    });
    if (count === 0) {
      throw new NotFoundException("포괄평가 기록을 찾을 수 없습니다");
    }
    return this.get(actor, recipientId);
  }

  async addExternalService(
    actor: AuthenticatedUser,
    recipientId: string,
    data: ExternalServiceData,
  ): Promise<HomeCareCase> {
    await this.assertRecipient(actor, recipientId);
    await this.prisma.recipientExternalService.create({
      data: { recipientId, ...externalServiceData(data) },
    });
    return this.get(actor, recipientId);
  }

  async updateExternalService(
    actor: AuthenticatedUser,
    recipientId: string,
    serviceId: string,
    data: ExternalServiceData,
  ): Promise<HomeCareCase> {
    await this.assertRecipient(actor, recipientId);
    const { count } = await this.prisma.recipientExternalService.updateMany({
      where: { id: serviceId, recipientId },
      data: externalServiceData(data),
    });
    if (count === 0) throw new NotFoundException(SERVICE_NOT_FOUND);
    return this.get(actor, recipientId);
  }

  async removeExternalService(
    actor: AuthenticatedUser,
    recipientId: string,
    serviceId: string,
  ): Promise<HomeCareCase> {
    await this.assertRecipient(actor, recipientId);
    const { count } = await this.prisma.recipientExternalService.deleteMany({
      where: { id: serviceId, recipientId },
    });
    if (count === 0) throw new NotFoundException(SERVICE_NOT_FOUND);
    return this.get(actor, recipientId);
  }

  /** 재택의료 종결 날짜·사유를 적거나(둘 다) 지운다(둘 다 null). */
  async setEnd(
    actor: AuthenticatedUser,
    recipientId: string,
    { endedOn, reason }: z.output<typeof SetHomeCareEndSchema>,
  ): Promise<HomeCareCase> {
    const { count } = await this.prisma.recipient.updateMany({
      where: recipientWhere(actor, recipientId),
      data: { homeCareEndedOn: toDbDate(endedOn), homeCareEndReason: reason },
    });
    if (count === 0) throw new NotFoundException(RECIPIENT_NOT_FOUND);
    return this.get(actor, recipientId);
  }

  private async assertRecipient(
    actor: AuthenticatedUser,
    recipientId: string,
  ): Promise<void> {
    const recipient = await this.prisma.recipient.findFirst({
      where: recipientWhere(actor, recipientId),
      select: { id: true },
    });
    if (!recipient) throw new NotFoundException(RECIPIENT_NOT_FOUND);
  }
}
