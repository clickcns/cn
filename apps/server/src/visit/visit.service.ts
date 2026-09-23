import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  addKstDays,
  canBeAssignedVisits,
  checkVisitTimes,
  formFields,
  formIdsFor,
  FORMS,
  isRecordEditable,
  kstStartOfDay,
  PROFESSION_LABELS,
  PROGRAM_LABELS,
  VISIT_STATUSES,
  VisitFormsSchema,
  withParticle,
  type CreateVisitSchema,
  type FormData,
  type FormId,
  type SaveVisitRecordSchema,
  type VisitDetail,
  type VisitForms,
  type VisitListQuerySchema,
  type VisitListResponse,
  type VisitStatus,
} from "@repo/shared-types";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import {
  assertOrganizationAccess,
  resolveOrganizationFilter,
} from "../core/utils/org-scope.js";
import type { Prisma } from "../generated/prisma/client.js";
import { handlePrismaError, PrismaService } from "../prisma/index.js";
import {
  toFormIds,
  toVisitDetail,
  toVisitSummary,
  visitDetailArgs,
  visitSummaryArgs,
  type VisitDetailRow,
} from "./visit.mapper.js";

const VISIT_NOT_FOUND = "방문을 찾을 수 없습니다";
const RECORD_LOCKED = "확정된 방문 기록은 수정할 수 없습니다";

/**
 * 사용자가 볼 수 있는 방문의 범위. 목록과 단건 조회가 같은 조건을 쓴다.
 * 기관 범위 + 현장 직원은 본인 방문만. 범위 밖 방문은 "없음"(404)으로 보인다.
 */
function visitScope(actor: AuthenticatedUser): Prisma.VisitWhereInput {
  return {
    organizationId: resolveOrganizationFilter(actor),
    staffId: actor.role === "STAFF" ? actor.id : undefined,
  };
}

/** 이월 칸만 골라 낸다. */
function pickCarryOver(formId: FormId, data: FormData): FormData {
  const picked: FormData = {};
  for (const field of formFields(FORMS[formId])) {
    if (field.carryOver && field.key in data) {
      picked[field.key] = data[field.key];
    }
  }
  return picked;
}

@Injectable()
export class VisitService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 방문 일시 오름차순(같으면 id순)으로 페이지 단위로 준다.
   * total·statusCounts는 페이지와 무관하게 조건 전체 기준이다(잘린 목록을 세면 틀린다).
   */
  async list(
    actor: AuthenticatedUser,
    query: z.output<typeof VisitListQuerySchema>,
  ): Promise<VisitListResponse> {
    const scope = visitScope(actor);
    const where: Prisma.VisitWhereInput = {
      ...scope,
      organizationId: resolveOrganizationFilter(actor, query.organizationId),
      staffId: scope.staffId ?? query.staffId,
      recipientId: query.recipientId,
      program: query.program,
      status: query.status,
      scheduledAt: scheduledRange(query),
    };
    const { page, pageSize } = query;

    const [rows, grouped] = await Promise.all([
      this.prisma.visit.findMany({
        ...visitSummaryArgs,
        where,
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.visit.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      VISIT_STATUSES.map((status) => [status, 0]),
    ) as Record<VisitStatus, number>;
    for (const group of grouped) {
      statusCounts[group.status] = group._count._all;
    }
    const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

    return {
      items: rows.map(toVisitSummary),
      total,
      statusCounts,
      page,
      pageSize,
    };
  }

  async get(actor: AuthenticatedUser, id: string): Promise<VisitDetail> {
    const row = await this.prisma.visit.findFirst({
      ...visitDetailArgs,
      where: { id, ...visitScope(actor) },
    });
    if (!row) throw new NotFoundException(VISIT_NOT_FOUND);
    return this.toDetail(actor, row);
  }

  async create(
    actor: AuthenticatedUser,
    dto: z.output<typeof CreateVisitSchema>,
  ): Promise<VisitDetail> {
    // 현장 직원은 항상 본인 방문으로, 관리자는 지정한 담당자(없으면 본인)로 만든다.
    const staffId =
      actor.role === "STAFF" ? actor.id : (dto.staffId ?? actor.id);
    const [recipient, staff] = await Promise.all([
      this.prisma.recipient.findUnique({
        where: { id: dto.recipientId },
        select: {
          organizationId: true,
          isActive: true,
          organization: { select: { programs: true } },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: staffId },
        select: {
          role: true,
          profession: true,
          isActive: true,
          organizationId: true,
        },
      }),
    ]);

    if (!recipient) throw new NotFoundException("수급자를 찾을 수 없습니다");
    assertOrganizationAccess(
      actor,
      recipient.organizationId,
      "수급자를 찾을 수 없습니다",
    );
    if (!recipient.isActive) {
      throw new BadRequestException("사용이 중지된 수급자입니다");
    }
    if (!recipient.organization.programs.includes(dto.program)) {
      throw new BadRequestException(
        `이 기관은 ${PROGRAM_LABELS[dto.program]} 사업을 하지 않습니다`,
      );
    }
    if (
      !staff?.isActive ||
      !canBeAssignedVisits(staff) ||
      staff.organizationId !== recipient.organizationId
    ) {
      throw new BadRequestException(
        "담당자를 선택해 주세요(수급자와 같은 기관의, 직종이 있는 사용자만 배정할 수 있습니다)",
      );
    }
    const formIds = formIdsFor(dto.program, staff.profession);
    if (formIds.length === 0) {
      const profession = staff.profession
        ? PROFESSION_LABELS[staff.profession]
        : "이 사용자";
      throw new BadRequestException(
        `${withParticle(profession, "은/는")} ${PROGRAM_LABELS[dto.program]} 방문을 맡을 수 없습니다`,
      );
    }

    const row = await this.prisma.visit.create({
      ...visitDetailArgs,
      data: {
        organizationId: recipient.organizationId,
        recipientId: dto.recipientId,
        staffId,
        program: dto.program,
        formIds: [...formIds],
        scheduledAt: new Date(dto.scheduledAt),
      },
    });
    return this.toDetail(actor, row);
  }

  async saveRecord(
    actor: AuthenticatedUser,
    id: string,
    { forms, startedAt, endedAt }: z.output<typeof SaveVisitRecordSchema>,
  ): Promise<VisitDetail> {
    const visit = await this.assertWritable(actor, id);
    const unknown = (Object.keys(forms) as FormId[]).filter(
      (formId) => !visit.formIds.includes(formId),
    );
    if (unknown.length > 0) {
      throw new BadRequestException("이 방문에서 쓰지 않는 서식입니다");
    }
    // 한쪽만 보내는 요청도 있으므로 저장된 값과 합친 뒤 스키마와 같은 규칙으로 확인한다.
    const timeError = checkVisitTimes(
      startedAt === undefined ? visit.startedAt : toOptionalDate(startedAt),
      endedAt === undefined ? visit.endedAt : toOptionalDate(endedAt),
    );
    if (timeError) throw new BadRequestException(timeError);

    const upserts = Object.entries(forms).map(([formId, data]) =>
      this.prisma.visitForm.upsert({
        where: { visitId_formId: { visitId: id, formId } },
        create: {
          visitId: id,
          formId,
          data: data as Prisma.InputJsonValue,
        },
        update: { data: data as Prisma.InputJsonValue },
      }),
    );

    try {
      // 서식을 먼저 쓰고, 확정되지 않았을 때만 방문을 갱신한다. 이미 확정됐으면 전체를 되돌린다.
      const results = await this.prisma.$transaction([
        ...upserts,
        this.prisma.visit.update({
          ...visitDetailArgs,
          where: { id, status: { not: "CONFIRMED" } },
          data: {
            startedAt: toOptionalDate(startedAt),
            endedAt: toOptionalDate(endedAt),
            status: "DRAFT",
          },
        }),
      ]);
      return this.toDetail(actor, results.at(-1) as VisitDetailRow);
    } catch (error) {
      handlePrismaError(error, { staleWrite: RECORD_LOCKED });
    }
  }

  async confirm(actor: AuthenticatedUser, id: string): Promise<VisitDetail> {
    const visit = await this.assertWritable(actor, id);
    const saved = await this.prisma.visitForm.findMany({
      where: { visitId: id },
      select: { formId: true, data: true },
    });
    const missing = visit.formIds.find(
      (formId) => !saved.some((row) => row.formId === formId),
    );
    if (missing) {
      throw new BadRequestException(
        `${withParticle(FORMS[missing].shortTitle, "이/가")} 저장되지 않았습니다. 먼저 임시 저장해 주세요`,
      );
    }
    // 저장할 때와 같은 검사(서식 정의)를 다시 통과해야 확정한다. 문구는 "서식 이름 · 오류"다.
    const parsed = VisitFormsSchema.safeParse(
      Object.fromEntries(saved.map((row) => [row.formId, row.data])),
    );
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? "내용이 올바르지 않습니다",
      );
    }

    try {
      const row = await this.prisma.visit.update({
        ...visitDetailArgs,
        where: { id, status: "DRAFT" },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      return this.toDetail(actor, row);
    } catch (error) {
      handlePrismaError(error, { staleWrite: "이미 확정된 방문입니다" });
    }
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<{ ok: true }> {
    const visit = await this.prisma.visit.findFirst({
      where: { id, ...visitScope(actor) },
      select: { id: true },
    });
    if (!visit) throw new NotFoundException(VISIT_NOT_FOUND);

    // 예정(SCHEDULED) 상태일 때만 지운다(shared canDeleteVisit과 같은 규칙).
    const { count } = await this.prisma.visit.deleteMany({
      where: { id, status: "SCHEDULED" },
    });
    if (count === 0) {
      throw new ConflictException("기록이 작성된 방문은 삭제할 수 없습니다");
    }
    return { ok: true };
  }

  /**
   * 기록을 쓸 수 있는 방문인지 확인한다: 보이는 방문이고(404), 담당자 본인이며(403),
   * 확정 전(409). 음성 구술(dictation)도 같은 규칙을 쓴다.
   */
  async assertWritable(actor: AuthenticatedUser, id: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id, ...visitScope(actor) },
      select: {
        staffId: true,
        status: true,
        formIds: true,
        startedAt: true,
        endedAt: true,
      },
    });
    if (!visit) throw new NotFoundException(VISIT_NOT_FOUND);
    if (visit.staffId !== actor.id) {
      throw new ForbiddenException("담당자만 기록을 작성할 수 있습니다");
    }
    if (!isRecordEditable(visit.status)) {
      throw new ConflictException(RECORD_LOCKED);
    }
    return { ...visit, formIds: toFormIds(visit.formIds) };
  }

  /** 이월 값은 기록 폼을 여는 담당자에게만 쓸모가 있으므로 그때만 찾는다. */
  private async toDetail(
    actor: AuthenticatedUser,
    row: VisitDetailRow,
  ): Promise<VisitDetail> {
    const writable = row.staffId === actor.id && isRecordEditable(row.status);
    return toVisitDetail(row, writable ? await this.carryOver(row) : {});
  }

  /**
   * 아직 저장하지 않은 서식에 쓸 이월 값: 같은 수급자의 이 방문보다 앞선 방문 중
   * 같은 서식을 저장한 가장 최근 것에서 이월 칸만 가져온다.
   */
  private async carryOver(row: VisitDetailRow): Promise<VisitForms> {
    const saved = new Set(row.forms.map((form) => form.formId));
    const pending = toFormIds(row.formIds).filter((id) => !saved.has(id));
    const entries = await Promise.all(
      pending.map(async (formId) => {
        const previous = await this.prisma.visitForm.findFirst({
          where: {
            formId,
            visit: {
              recipientId: row.recipientId,
              scheduledAt: { lt: row.scheduledAt },
            },
          },
          orderBy: { visit: { scheduledAt: "desc" } },
          select: { data: true },
        });
        return previous
          ? ([
              formId,
              pickCarryOver(formId, previous.data as FormData),
            ] as const)
          : null;
      }),
    );
    return Object.fromEntries(entries.filter((entry) => entry !== null));
  }
}

/**
 * 날짜 조건(한국 날짜)을 scheduledAt 범위로 바꾼다. `to`는 그날을 포함한다.
 * from ≤ to 검사는 VisitListQuerySchema가 한다.
 */
function scheduledRange(
  query: z.output<typeof VisitListQuerySchema>,
): Prisma.DateTimeFilter | undefined {
  if (query.date) {
    return {
      gte: kstStartOfDay(query.date),
      lt: kstStartOfDay(addKstDays(query.date, 1)),
    };
  }
  if (!query.from && !query.to) return undefined;
  return {
    gte: query.from ? kstStartOfDay(query.from) : undefined,
    lt: query.to ? kstStartOfDay(addKstDays(query.to, 1)) : undefined,
  };
}

/** undefined는 "변경 없음", null은 "지움". */
function toOptionalDate(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}
