import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  addKstDays,
  checkVisitTimes,
  conflictsOnSameDay,
  countVisitsByDay,
  emptyStatusCounts,
  findMissingRequired,
  totalCount,
  formatKstTime,
  formFields,
  FORMS,
  isRecordEditable,
  keepDraftForms,
  missingRequiredMessage,
  kstStartOfDay,
  PROGRAM_LABELS,
  selectForms,
  VISIT_CALENDAR_MAX_ITEMS,
  VisitFormsSchema,
  withParticle,
  type CreateVisitSchema,
  type FormData,
  type FormId,
  type Program,
  type SameDayWarningQuerySchema,
  type SameDayWarningResponse,
  type SaveVisitRecordSchema,
  type UpdateVisitFormsSchema,
  type UpdateVisitSchema,
  type VisitCalendarQuerySchema,
  type VisitCalendarResponse,
  type VisitDetail,
  type VisitRecordVersionDetail,
  type VisitRecordVersionSummary,
  type VisitForms,
  type VisitListQuerySchema,
  type VisitListResponse,
  type VisitOrganizationCount,
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
  recordHeaderSelect,
  recordVersionData,
  toRecordSnapshot,
} from "./record-version.js";
import { isAssignableStaff, planVisitUpdate } from "./visit-update.js";
import {
  calendarItemArgs,
  toFormIds,
  toCalendarDays,
  toVisitCalendarItem,
  toVisitDetail,
  toVisitForms,
  toVisitRecordVersionDetail,
  toVisitRecordVersionSummary,
  toVisitSummary,
  versionActorsArgs,
  versionSummaryArgs,
  visitDetailArgs,
  visitSummaryArgs,
  type VisitDetailRow,
} from "./visit.mapper.js";

const VISIT_NOT_FOUND = "방문을 찾을 수 없습니다";
const RECORD_LOCKED =
  "확정된 방문 기록입니다. 고치려면 [수정]을 눌러 작성 중으로 되돌려 주세요";

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

/**
 * 목록과 달력이 함께 쓰는 조회 조건: 보이는 범위(visitScope) + 필터.
 * 현장 직원은 staffId 필터와 상관없이 본인 방문만 본다.
 */
function filterWhere(
  actor: AuthenticatedUser,
  filter: {
    organizationId?: string;
    staffId?: string;
    recipientId?: string;
    program?: Program;
    /** 목록은 여러 상태를 함께 받는다. */
    status?: VisitStatus | VisitStatus[];
  },
  scheduledAt: Prisma.DateTimeFilter | undefined,
): Prisma.VisitWhereInput {
  const scope = visitScope(actor);
  return {
    ...scope,
    organizationId: resolveOrganizationFilter(actor, filter.organizationId),
    staffId: scope.staffId ?? filter.staffId,
    recipientId: filter.recipientId,
    program: filter.program,
    status: Array.isArray(filter.status)
      ? { in: filter.status }
      : filter.status,
    scheduledAt,
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
      profession: true,
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
    const where = filterWhere(actor, query, scheduledRange(query));
    const { page, pageSize } = query;
    const byOrganization = query.groupBy === "organization";

    const [rows, grouped] = await Promise.all([
      this.prisma.visit.findMany({
        ...visitSummaryArgs,
        where,
        // 기관별로 묶어 볼 때는 한 기관의 방문이 페이지를 건너 이어지게 기관부터 정렬한다.
        orderBy: byOrganization
          ? [
              { organization: { name: "asc" } },
              { organizationId: "asc" },
              { scheduledAt: "asc" },
              { id: "asc" },
            ]
          : [{ scheduledAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      // 기관·상태별로 한 번에 세서 전체 건수와 기관별 건수를 함께 만든다.
      this.prisma.visit.groupBy({
        by: ["organizationId", "status"],
        where,
        _count: { _all: true },
      }),
    ]);

    const statusCounts = emptyStatusCounts();
    const byOrganizationCounts = new Map<string, VisitOrganizationCount>();
    for (const group of grouped) {
      const count = group._count._all;
      statusCounts[group.status] += count;
      let organization = byOrganizationCounts.get(group.organizationId);
      if (!organization) {
        organization = {
          organizationId: group.organizationId,
          total: 0,
          statusCounts: emptyStatusCounts(),
        };
        byOrganizationCounts.set(group.organizationId, organization);
      }
      organization.total += count;
      organization.statusCounts[group.status] += count;
    }
    const total = totalCount(statusCounts);

    return {
      items: rows.map(toVisitSummary),
      total,
      statusCounts,
      ...(byOrganization && {
        organizationCounts: [...byOrganizationCounts.values()],
      }),
      page,
      pageSize,
    };
  }

  /**
   * 기간 안의 날짜별 상태 건수(달력). 권한 범위와 필터는 목록과 같다.
   * withVisits면 칩에 쓸 가벼운 방문 목록도 싣는다. 상한을 넘으면 목록 없이(null) 건수만 준다.
   */
  async calendar(
    actor: AuthenticatedUser,
    query: z.output<typeof VisitCalendarQuerySchema>,
  ): Promise<VisitCalendarResponse> {
    const where = filterWhere(actor, query, scheduledRange(query));
    const withVisits = query.withVisits === "true";
    if (withVisits) {
      // 칩 목록이 상한 안이면 그 목록으로 센다(쿼리 한 번).
      const rows = await this.prisma.visit.findMany({
        ...calendarItemArgs,
        where,
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        take: VISIT_CALENDAR_MAX_ITEMS + 1,
      });
      if (rows.length <= VISIT_CALENDAR_MAX_ITEMS) {
        return {
          days: countVisitsByDay(rows),
          visits: rows.map(toVisitCalendarItem),
        };
      }
    }
    // 건수만 줄 때(현장 웹, 상한 초과)는 DB가 한국 날짜 생성 열로 센다.
    const groups = await this.prisma.visit.groupBy({
      by: ["scheduledDate", "status"],
      where,
      _count: { _all: true },
    });
    const days = toCalendarDays(groups);
    return withVisits ? { days, visits: null } : { days };
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
    const staffId = visitStaffId(actor, dto.staffId);
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
    if (!isAssignableStaff(staff, recipient.organizationId)) {
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
        profession: staff.profession,
        formIds: selection.formIds,
        scheduledAt: new Date(dto.scheduledAt),
      },
    });
    return this.toDetail(actor, row);
  }

  /**
   * 만들려는 방문과 같은 날, 함께 있으면 재택의료 급여를 산정하지 않는 방문(conflictsOnSameDay)이
   * 있는지 알려 준다. 현장 직원은 다른 직원의 방문을 볼 수 없으므로 방문 내용 대신 시각·사업만 문구로 준다.
   */
  async sameDayWarnings(
    actor: AuthenticatedUser,
    query: z.output<typeof SameDayWarningQuerySchema>,
  ): Promise<SameDayWarningResponse> {
    const staffId = visitStaffId(actor, query.staffId);
    const [recipient, staff] = await Promise.all([
      this.prisma.recipient.findUnique({
        where: { id: query.recipientId },
        select: { organizationId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: staffId },
        select: { profession: true },
      }),
    ]);
    if (!recipient) throw new NotFoundException("수급자를 찾을 수 없습니다");
    assertOrganizationAccess(
      actor,
      recipient.organizationId,
      "수급자를 찾을 수 없습니다",
    );

    const planned = {
      program: query.program,
      profession: staff?.profession ?? null,
    };
    const sameDay = await this.prisma.visit.findMany({
      where: {
        recipientId: query.recipientId,
        scheduledAt: scheduledRange({ date: query.date }),
      },
      select: { scheduledAt: true, program: true, profession: true },
      orderBy: { scheduledAt: "asc" },
    });
    const conflicts = sameDay.filter((visit) =>
      conflictsOnSameDay(planned, visit),
    );
    if (conflicts.length === 0) return { warnings: [] };
    const visits = conflicts
      .map(
        (visit) =>
          `${formatKstTime(visit.scheduledAt)} ${PROGRAM_LABELS[visit.program]}`,
      )
      .join(", ");
    return {
      warnings: [
        `이날 ${visits} 방문이 있습니다. 재택의료센터 간호사 방문과 장기요양 방문간호가 같은 날 있으면 재택의료 급여를 산정하지 않습니다`,
      ],
    };
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
      // 서식 규칙은 방문한 직종(Visit.profession)으로 정한다.
      const selection = selectForms(visit.program, visit.profession, formIds);
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
      // 저장한 서식 값과 확정본에 함께 보관할 서식 머리
      const { forms: saved, ...header } = await tx.visit.findUniqueOrThrow({
        where: { id },
        select: {
          ...recordHeaderSelect,
          forms: {
            where: { formId: { in: visit.formIds } },
            select: { formId: true, data: true },
          },
        },
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
      // 확정 전에 반드시 채울 칸(서식 정의의 required)
      const missingRequired = findMissingRequired(visit.formIds, parsed.data);
      if (missingRequired.length > 0) {
        throw new BadRequestException(missingRequiredMessage(missingRequired));
      }
      // 확정본을 통째로 보관한다(1차, 2차 …). [수정]으로 되돌려도 지우지 않는다.
      const confirmedAt = new Date();
      const latest = await latestRecordVersion(tx, id);
      await tx.visitRecordVersion.create({
        data: recordVersionData({
          visitId: id,
          version: (latest?.version ?? 0) + 1,
          confirmedById: actor.id,
          confirmedAt,
          snapshot: toRecordSnapshot(visit, parsed.data, header),
        }),
        select: { id: true },
      });
      return tx.visit.update({
        ...visitDetailArgs,
        where: { id },
        data: { status: "CONFIRMED", confirmedAt },
      });
    });
    return this.toDetail(actor, row);
  }

  /**
   * 확정한 기록을 다시 고칠 수 있게 작성 중(DRAFT)으로 되돌린다. 담당자 본인만 한다.
   * 고친 뒤 다시 확정해야 하므로 "확정 = 모든 서식이 저장·검사를 통과한 상태"는 그대로다.
   */
  async reopen(actor: AuthenticatedUser, id: string): Promise<VisitDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      await lockVisitRow(tx, id);
      const visit = await tx.visit.findFirst({
        where: { id, ...visitScope(actor) },
        select: {
          staffId: true,
          status: true,
          program: true,
          profession: true,
          formIds: true,
          startedAt: true,
          endedAt: true,
          confirmedAt: true,
        },
      });
      if (!visit) throw new NotFoundException(VISIT_NOT_FOUND);
      if (visit.staffId !== actor.id) {
        throw new ForbiddenException("담당자만 기록을 고칠 수 있습니다");
      }
      if (visit.status !== "CONFIRMED") {
        throw new ConflictException("확정된 방문이 아닙니다");
      }
      // 지금 확정본에 되돌린 사람·시각을 적는다(지우지 않는다).
      const reopened = { reopenedById: actor.id, reopenedAt: new Date() };
      const confirmedAt = visit.confirmedAt ?? new Date();
      const latest = await latestRecordVersion(tx, id);
      if (latest && latest.confirmedAt.getTime() === confirmedAt.getTime()) {
        await tx.visitRecordVersion.update({
          where: { id: latest.id },
          data: reopened,
        });
      } else {
        // 확정본 이력 전에 확정한 방문: 그 확정본을 여기서 보관한다(서식 머리는 지금 정보).
        const { forms, ...header } = await tx.visit.findUniqueOrThrow({
          where: { id },
          select: {
            ...recordHeaderSelect,
            forms: { select: { formId: true, data: true } },
          },
        });
        await tx.visitRecordVersion.create({
          data: {
            ...recordVersionData({
              visitId: id,
              version: (latest?.version ?? 0) + 1,
              confirmedById: visit.staffId,
              confirmedAt,
              snapshot: toRecordSnapshot(
                { ...visit, formIds: toFormIds(visit.formIds) },
                toVisitForms(forms),
                header,
              ),
            }),
            ...reopened,
          },
          select: { id: true },
        });
      }
      return tx.visit.update({
        ...visitDetailArgs,
        where: { id },
        data: { status: "DRAFT", confirmedAt: null },
      });
    });
    return this.toDetail(actor, row);
  }

  /**
   * 방문 일정·담당자 바꾸기(기관 관리자·운영자, 역할은 컨트롤러가 막는다). 규칙은 planVisitUpdate.
   * 방문 행을 잠그고 다시 읽으므로 기록 저장·구술 저장·확정과 차례로 처리된다.
   */
  async update(
    actor: AuthenticatedUser,
    id: string,
    dto: z.output<typeof UpdateVisitSchema>,
  ): Promise<VisitDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      await lockVisitRow(tx, id);
      const visit = await tx.visit.findFirst({
        where: { id, ...visitScope(actor) },
        select: {
          status: true,
          program: true,
          organizationId: true,
          staffId: true,
          scheduledAt: true,
          formIds: true,
          profession: true,
          dictation: { select: { id: true } },
        },
      });
      if (!visit) throw new NotFoundException(VISIT_NOT_FOUND);

      const newStaff =
        dto.staffId && dto.staffId !== visit.staffId
          ? await tx.user.findUnique({
              where: { id: dto.staffId },
              select: {
                role: true,
                profession: true,
                isActive: true,
                organizationId: true,
              },
            })
          : null;
      const plan = planVisitUpdate(
        {
          status: visit.status,
          program: visit.program,
          organizationId: visit.organizationId,
          staffId: visit.staffId,
          scheduledAt: visit.scheduledAt,
          formIds: toFormIds(visit.formIds),
          hasDictation: visit.dictation !== null,
          profession: visit.profession,
        },
        dto,
        newStaff,
      );
      if (!plan.ok) {
        throw plan.kind === "conflict"
          ? new ConflictException(plan.message)
          : new BadRequestException(plan.message);
      }
      if (Object.keys(plan.data).length === 0) {
        return tx.visit.findUniqueOrThrow({
          ...visitDetailArgs,
          where: { id },
        });
      }
      return tx.visit.update({
        ...visitDetailArgs,
        where: { id },
        data: plan.data,
      });
    });
    return this.toDetail(actor, row);
  }

  /** 확정본 이력(1차, 2차 …, 요약만). 방문을 볼 수 있는 사람이면 본다. */
  async versions(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<VisitRecordVersionSummary[]> {
    const visit = await this.prisma.visit.findFirst({
      where: { id, ...visitScope(actor) },
      select: { versions: versionSummaryArgs },
    });
    if (!visit) throw new NotFoundException(VISIT_NOT_FOUND);
    return visit.versions.map(toVisitRecordVersionSummary);
  }

  /** 확정본 한 벌(보관한 값과 위변조 확인). 방문을 볼 수 있는 사람이면 본다. */
  async version(
    actor: AuthenticatedUser,
    id: string,
    version: number,
  ): Promise<VisitRecordVersionDetail> {
    const row = await this.prisma.visitRecordVersion.findFirst({
      where: { visitId: id, version, visit: visitScope(actor) },
      ...versionActorsArgs,
    });
    if (!row) throw new NotFoundException("확정본을 찾을 수 없습니다");
    return toVisitRecordVersionDetail(row);
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
    await lockVisitRow(tx, id);
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
 * 날짜 조건(한국 날짜: 하루 date, 또는 기간 from~to)을 scheduledAt 범위로 바꾼다. `to`는 그날을 포함한다.
 * 목록·달력·같은 날 경고가 함께 쓴다. from ≤ to 검사는 각 스키마가 한다.
 */
function scheduledRange(query: {
  date?: string;
  from?: string;
  to?: string;
}): Prisma.DateTimeFilter | undefined {
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

/**
 * 마지막 확정본(다음 차수는 이 차수 + 1). 방문 행을 잠근 트랜잭션 안에서만 부른다
 * (동시에 확정해도 차수가 겹치지 않게).
 */
function latestRecordVersion(tx: Prisma.TransactionClient, visitId: string) {
  return tx.visitRecordVersion.findFirst({
    where: { visitId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, confirmedAt: true },
  });
}

/** 방문 행을 잠근다(SELECT … FOR UPDATE). 같은 방문을 바꾸는 요청을 차례로 처리한다. 트랜잭션 안에서만. */
function lockVisitRow(tx: Prisma.TransactionClient, id: string) {
  return tx.$queryRaw`SELECT id FROM visits WHERE id = ${id} FOR UPDATE`;
}

/** 방문 담당자: 현장 직원은 늘 본인, 관리자는 고른 담당자(없으면 본인). */
function visitStaffId(
  actor: AuthenticatedUser,
  requested: string | null | undefined,
): string {
  return actor.role === "STAFF" ? actor.id : (requested ?? actor.id);
}

/** undefined는 "변경 없음", null은 "지움". */
function toOptionalDate(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}
