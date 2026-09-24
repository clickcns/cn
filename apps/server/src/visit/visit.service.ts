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
  FORMS,
  isRecordEditable,
  keepDraftForms,
  kstStartOfDay,
  PROGRAM_LABELS,
  selectForms,
  VISIT_STATUSES,
  VisitFormsSchema,
  withParticle,
  type CreateVisitSchema,
  type FormData,
  type FormId,
  type SaveVisitRecordSchema,
  type UpdateVisitFormsSchema,
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
import { toVisitDictation } from "../dictation/dictation.mapper.js";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/index.js";
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

/** 담당자 본인(403)이고 확정 전(409)이어야 기록을 쓸 수 있다. */
function checkWritable(
  actor: AuthenticatedUser,
  visit: { staffId: string; status: VisitStatus },
  lockedMessage = RECORD_LOCKED,
): void {
  if (visit.staffId !== actor.id) {
    throw new ForbiddenException("담당자만 기록을 작성할 수 있습니다");
  }
  if (!isRecordEditable(visit.status)) {
    throw new ConflictException(lockedMessage);
  }
}

/**
 * 기록을 쓸 수 있는 방문을 읽는다: 보이는 방문(404)·담당자 본인(403)·확정 전(409).
 * 잠금 없이(assertWritable)와 잠근 트랜잭션 안에서(lockWritable) 같은 규칙을 쓴다.
 */
async function findWritable(
  client: Prisma.TransactionClient,
  actor: AuthenticatedUser,
  id: string,
  lockedMessage = RECORD_LOCKED,
) {
  const visit = await client.visit.findFirst({
    where: { id, ...visitScope(actor) },
    select: {
      staffId: true,
      status: true,
      program: true,
      formIds: true,
      startedAt: true,
      endedAt: true,
    },
  });
  if (!visit) throw new NotFoundException(VISIT_NOT_FOUND);
  checkWritable(actor, visit, lockedMessage);
  return { ...visit, formIds: toFormIds(visit.formIds) };
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
          programs: true,
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
    if (!recipient.programs.includes(dto.program)) {
      throw new BadRequestException(
        `이 수급자는 ${PROGRAM_LABELS[dto.program]} 사업에 등록되어 있지 않습니다. 수급자 정보에서 등록 사업을 확인해 주세요`,
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
    // 서식은 사업·담당자 직종의 규칙 안에서 고른다(보내지 않으면 기본값).
    const selection = selectForms(dto.program, staff.profession, dto.formIds);
    if (!selection.ok) throw new BadRequestException(selection.message);

    const row = await this.prisma.visit.create({
      ...visitDetailArgs,
      data: {
        organizationId: recipient.organizationId,
        recipientId: dto.recipientId,
        staffId,
        program: dto.program,
        formIds: selection.formIds,
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
    const row = await this.prisma.$transaction(async (tx) => {
      const visit = await this.lockWritable(tx, actor, id);
      const unknown = (Object.keys(forms) as FormId[]).filter(
        (formId) => !visit.formIds.includes(formId),
      );
      if (unknown.length > 0) {
        throw new BadRequestException(
          "이 방문에서 쓰지 않는 서식입니다. 화면을 새로 고쳐 주세요",
        );
      }
      // 한쪽만 보내는 요청도 있으므로 저장된 값과 합친 뒤 스키마와 같은 규칙으로 확인한다.
      const timeError = checkVisitTimes(
        startedAt === undefined ? visit.startedAt : toOptionalDate(startedAt),
        endedAt === undefined ? visit.endedAt : toOptionalDate(endedAt),
      );
      if (timeError) throw new BadRequestException(timeError);

      for (const [formId, data] of Object.entries(forms)) {
        await tx.visitForm.upsert({
          where: { visitId_formId: { visitId: id, formId } },
          create: {
            visitId: id,
            formId,
            data: data as Prisma.InputJsonValue,
          },
          update: { data: data as Prisma.InputJsonValue },
        });
      }
      return tx.visit.update({
        ...visitDetailArgs,
        where: { id },
        data: {
          startedAt: toOptionalDate(startedAt),
          endedAt: toOptionalDate(endedAt),
          status: "DRAFT",
        },
      });
    });
    return this.toDetail(actor, row);
  }

  /**
   * 확정 전 방문의 서식을 바꾼다(선택 서식 켜고 끄기). 기록을 쓰는 담당자 본인만 한다.
   * 뺀 서식은 저장한 값과 구술 초안(값·검사 결과·되묻기)에서도 지우고, 더한 서식은 이월 값과 함께 돌려준다.
   */
  async updateForms(
    actor: AuthenticatedUser,
    id: string,
    { formIds }: z.output<typeof UpdateVisitFormsSchema>,
  ): Promise<VisitDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      const visit = await this.lockWritable(tx, actor, id);
      // 쓰는 사람이 곧 담당자다. 확정 전 방문이 있으면 직종을 바꿀 수 없으므로 방문을 만들 때의 직종과 같다.
      const selection = selectForms(visit.program, actor.profession, formIds);
      if (!selection.ok) throw new BadRequestException(selection.message);
      const removed = visit.formIds.filter(
        (formId) => !selection.formIds.includes(formId),
      );
      if (removed.length > 0) {
        await tx.visitForm.deleteMany({
          where: { visitId: id, formId: { in: removed } },
        });
        const dictation = await tx.visitDictation.findUnique({
          where: { visitId: id },
        });
        if (dictation) {
          const kept = keepDraftForms(
            toVisitDictation(dictation),
            selection.formIds,
          );
          await tx.visitDictation.update({
            where: { visitId: id },
            data: {
              draft: kept.draft as Prisma.InputJsonValue,
              issues: kept.issues as unknown as Prisma.InputJsonValue,
              questions: kept.questions as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }
      return tx.visit.update({
        ...visitDetailArgs,
        where: { id },
        data: { formIds: selection.formIds },
      });
    });
    return this.toDetail(actor, row);
  }

  async confirm(actor: AuthenticatedUser, id: string): Promise<VisitDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      const visit = await this.lockWritable(tx, actor, id);
      const saved = await tx.visitForm.findMany({
        where: { visitId: id, formId: { in: visit.formIds } },
        select: { formId: true, data: true },
      });
      const missing = visit.formIds.find(
        (formId) => !saved.some((form) => form.formId === formId),
      );
      if (missing) {
        throw new BadRequestException(
          `${withParticle(FORMS[missing].shortTitle, "이/가")} 저장되지 않았습니다. 먼저 임시 저장해 주세요`,
        );
      }
      // 저장할 때와 같은 검사(서식 정의)를 다시 통과해야 확정한다. 문구는 "서식 이름 · 오류"다.
      const parsed = VisitFormsSchema.safeParse(
        Object.fromEntries(saved.map((form) => [form.formId, form.data])),
      );
      if (!parsed.success) {
        throw new BadRequestException(
          parsed.error.issues[0]?.message ?? "내용이 올바르지 않습니다",
        );
      }
      return tx.visit.update({
        ...visitDetailArgs,
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
    });
    return this.toDetail(actor, row);
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

  /** 잠그지 않고 기록을 쓸 수 있는지 확인한다(음성 구술의 조회·삭제·초안 준비). */
  async assertWritable(actor: AuthenticatedUser, id: string) {
    return findWritable(this.prisma, actor, id);
  }

  /**
   * 오래 걸리는 작업(음성인식·LLM) 뒤에 기록을 쓸 때 쓴다. 방문 행을 잠그고 담당자·확정 여부를
   * 다시 확인한 뒤 같은 트랜잭션에서 write를 실행한다. 그 사이 확정됐으면 쓰지 않고 409다.
   * write는 잠근 뒤 읽은 방문(그 사이 바뀐 서식 목록 포함)을 받는다.
   */
  async writeIfStillWritable<T>(
    actor: AuthenticatedUser,
    id: string,
    lockedMessage: string,
    write: (
      tx: Prisma.TransactionClient,
      visit: { formIds: FormId[] },
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const visit = await this.lockWritable(tx, actor, id, lockedMessage);
      return write(tx, visit);
    });
  }

  /**
   * 방문 행을 잠그고(FOR UPDATE) 기록을 쓸 수 있는지 확인한다. 트랜잭션 안에서만 쓴다.
   * 같은 방문의 저장·서식 바꾸기·확정·구술 저장은 이 잠금으로 차례로 처리되므로,
   * 확정은 그 순간의 서식 목록이 모두 저장됐는지 본다.
   */
  private async lockWritable(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    id: string,
    lockedMessage?: string,
  ) {
    await tx.$queryRaw`SELECT id FROM visits WHERE id = ${id} FOR UPDATE`;
    return findWritable(tx, actor, id, lockedMessage);
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
