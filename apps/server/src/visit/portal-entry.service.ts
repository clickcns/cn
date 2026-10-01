import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  defaultPortalQueueFrom,
  formatKstDate,
  type MarkPortalEntrySchema,
  type PortalEntry,
  type PortalQueueQuerySchema,
  type PortalQueueResponse,
} from "@repo/shared-types";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/index.js";
import { toCareGrade } from "../recipient/recipient.mapper.js";
import { actorSelect, staffSelect, toFormIds } from "./visit.mapper.js";
import { filterWhere, scheduledRange, visitScope } from "./visit.service.js";

/** 미입력 목록이 한 번에 보는 확정 방문 수. 넘으면 truncated로 알린다. */
const PORTAL_QUEUE_MAX_VISITS = 1000;

const VISIT_NOT_FOUND = "방문을 찾을 수 없습니다";

const entryArgs = {
  select: { formId: true, enteredAt: true, note: true, enteredBy: actorSelect },
} as const satisfies Prisma.VisitPortalEntryDefaultArgs;

type EntryRow = Prisma.VisitPortalEntryGetPayload<typeof entryArgs>;

/** 방문 서식 순서로, 지금 방문에 있는 서식의 표시만(뺀 서식의 옛 표시는 건너뛴다). */
function toEntries(formIds: string[], rows: EntryRow[]): PortalEntry[] {
  const byForm = new Map(rows.map((row) => [row.formId, row]));
  return toFormIds(formIds).flatMap((formId) => {
    const row = byForm.get(formId);
    return row
      ? [
          {
            formId,
            enteredAt: row.enteredAt.toISOString(),
            enteredBy: row.enteredBy,
            note: row.note,
          },
        ]
      : [];
  });
}

/**
 * 포털 입력 표시(shared-types portal-entry.ts). 케어노트는 공식 전산과 연결되지 않으므로, 확정한
 * 서식을 심평원·공단에 옮겨 적었다고 담당자·관리자가 서식마다 한 번 표시하고, 표시가 없는 서식을
 * 미입력 목록으로 보여 준다. 볼 수 있는 방문의 범위는 방문 조회와 같다(현장 직원은 본인 방문).
 */
@Injectable()
export class PortalEntryService {
  constructor(private readonly prisma: PrismaService) {}

  /** 지난달 1일부터 오늘까지 확정 방문 중 포털 입력 표시가 없는 서식(방문 일시 오름차순). */
  async queue(
    actor: AuthenticatedUser,
    query: z.output<typeof PortalQueueQuerySchema>,
  ): Promise<PortalQueueResponse> {
    const to = formatKstDate();
    const from = defaultPortalQueueFrom(to);
    const rows = await this.prisma.visit.findMany({
      where: filterWhere(
        actor,
        { organizationId: query.organizationId, status: "CONFIRMED" },
        scheduledRange({ from, to }),
      ),
      select: {
        id: true,
        organizationId: true,
        formIds: true,
        scheduledAt: true,
        recipient: { select: { id: true, name: true, careGrade: true } },
        staff: staffSelect,
        portalEntries: { select: { formId: true } },
      },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      take: PORTAL_QUEUE_MAX_VISITS + 1,
    });
    const truncated = rows.length > PORTAL_QUEUE_MAX_VISITS;
    const items = rows.slice(0, PORTAL_QUEUE_MAX_VISITS).flatMap((row) => {
      const entered = new Set(row.portalEntries.map((entry) => entry.formId));
      return toFormIds(row.formIds)
        .filter((formId) => !entered.has(formId))
        .map((formId) => ({
          visitId: row.id,
          formId,
          organizationId: row.organizationId,
          scheduledAt: row.scheduledAt.toISOString(),
          recipient: {
            id: row.recipient.id,
            name: row.recipient.name,
            careGrade: toCareGrade(row.recipient.careGrade),
          },
          staff: row.staff,
        }));
    });
    return { items, from, to, truncated };
  }

  /** 방문의 포털 입력 표시(지금 방문 서식만, 서식 순서). */
  async entries(actor: AuthenticatedUser, id: string): Promise<PortalEntry[]> {
    const visit = await this.prisma.visit.findFirst({
      where: { id, ...visitScope(actor) },
      select: { formIds: true, portalEntries: entryArgs },
    });
    if (!visit) throw new NotFoundException(VISIT_NOT_FOUND);
    return toEntries(visit.formIds, visit.portalEntries);
  }

  /**
   * 서식 하나를 포털에 넣었다고 표시한다(다시 누르면 시각·메모를 새로). 확정한 방문만(409),
   * 방문에 있는 서식만(404) 표시한다.
   */
  async mark(
    actor: AuthenticatedUser,
    id: string,
    formId: string,
    input: z.output<typeof MarkPortalEntrySchema>,
  ): Promise<PortalEntry[]> {
    const visit = await this.findVisit(actor, id, formId);
    if (visit.status !== "CONFIRMED") {
      throw new ConflictException(
        "확정한 기록만 포털 입력 완료로 표시할 수 있습니다",
      );
    }
    const entry = {
      enteredAt: new Date(),
      enteredById: actor.id,
      note: input.note ?? null,
    };
    await this.prisma.visitPortalEntry.upsert({
      where: { visitId_formId: { visitId: id, formId } },
      create: { visitId: id, formId, ...entry },
      update: entry,
    });
    return this.entriesOf(id, visit.formIds);
  }

  /** 포털 입력 표시를 지운다(잘못 눌렀을 때). */
  async unmark(
    actor: AuthenticatedUser,
    id: string,
    formId: string,
  ): Promise<PortalEntry[]> {
    const visit = await this.findVisit(actor, id, formId);
    await this.prisma.visitPortalEntry.deleteMany({
      where: { visitId: id, formId },
    });
    return this.entriesOf(id, visit.formIds);
  }

  /** 볼 수 있는 방문(404)이고 그 방문에 있는 서식(404)이어야 표시를 바꾼다. */
  private async findVisit(
    actor: AuthenticatedUser,
    id: string,
    formId: string,
  ) {
    const visit = await this.prisma.visit.findFirst({
      where: { id, ...visitScope(actor) },
      select: { status: true, formIds: true },
    });
    if (!visit) throw new NotFoundException(VISIT_NOT_FOUND);
    if (!visit.formIds.includes(formId)) {
      throw new NotFoundException("이 방문에 없는 서식입니다");
    }
    return visit;
  }

  /** 표시를 바꾼 뒤 그 방문의 표시(방문은 findVisit이 이미 확인했다). */
  private async entriesOf(
    visitId: string,
    formIds: string[],
  ): Promise<PortalEntry[]> {
    const rows = await this.prisma.visitPortalEntry.findMany({
      where: { visitId },
      ...entryArgs,
    });
    return toEntries(formIds, rows);
  }
}
