import { Injectable } from "@nestjs/common";
import {
  formatKstDate,
  HOME_CARE_REVENUE_FORM_IDS,
  homeCarePriorStreaks,
  homeCareVisitFacts,
  kstMonthRange,
  ownLtcNursingDay,
  VISIT_CALENDAR_MAX_ITEMS,
  type ExternalServiceSchedule,
  type HomeCareMonthQuerySchema,
  type HomeCareMonthResponse,
} from "@repo/shared-types";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { fromDbDate, toDbDate } from "../core/utils/db-date.js";
import { resolveOrganizationFilter } from "../core/utils/org-scope.js";
import type { Prisma } from "../generated/prisma/client.js";
import { FeeScheduleService } from "../fee-schedule/fee-schedule.service.js";
import { PrismaService } from "../prisma/index.js";
import {
  homeCareRecipientSelect,
  toHomeCareRecipient,
} from "../recipient/home-care-case.mapper.js";
import {
  calendarItemArgs,
  toVisitCalendarItem,
  toVisitForms,
} from "./visit.mapper.js";
import { filterWhere } from "./visit.service.js";

/** 달력 항목 + 금액 셈에 쓰는 서식 값(제4·7·8호)과 방문 시각. */
const monthVisitArgs = {
  select: {
    ...calendarItemArgs.select,
    startedAt: true,
    endedAt: true,
    forms: {
      where: { formId: { in: HOME_CARE_REVENUE_FORM_IDS } },
      select: { formId: true, data: true },
    },
  },
} as const satisfies Prisma.VisitDefaultArgs;

/**
 * 재택의료 수입(shared-types home-care-revenue.ts)에 쓰는 한 달 자료. 기관 관리자·운영자만 부른다
 * (컨트롤러 @Roles). 방문 조회는 방문 목록과 같은 범위(filterWhere)다.
 */
@Injectable()
export class HomeCareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feeSchedules: FeeScheduleService,
  ) {}

  /**
   * 그달 재택의료센터 방문(모든 상태, 서식 값 대신 금액 셈에 쓰는 사실만)과 수급자(사례 정보 포함),
   * 수급자별로 그달 직전까지 기본료 요건을 확정 기록으로 이어서 채운 달 수(지속관리료). 방문이 상한을
   * 넘으면(운영자의 전체 기관 보기) 방문·수급자·연속 개월을 싣지 않는다.
   */
  async month(
    actor: AuthenticatedUser,
    query: z.output<typeof HomeCareMonthQuerySchema>,
  ): Promise<HomeCareMonthResponse> {
    const range = kstMonthRange(query.month);
    const filter = {
      organizationId: query.organizationId,
      program: "HOME_CARE_CENTER" as const,
    };
    const [rows, feeSet] = await Promise.all([
      this.prisma.visit.findMany({
        ...monthVisitArgs,
        where: filterWhere(actor, filter, range),
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        take: VISIT_CALENDAR_MAX_ITEMS + 1,
      }),
      this.feeSchedules.forMonth(query.month),
    ]);
    if (rows.length > VISIT_CALENDAR_MAX_ITEMS) {
      return {
        visits: null,
        recipients: [],
        priorStreaks: {},
        feeSet,
      };
    }
    const [recipientRows, ltcNursing, counts] = await Promise.all([
      // 사용 중이거나 그달 방문이 있고, 그달 전에 종결하지 않은 재택의료센터 수급자
      this.prisma.recipient.findMany({
        where: {
          organizationId: resolveOrganizationFilter(
            actor,
            query.organizationId,
          ),
          programs: { has: "HOME_CARE_CENTER" },
          AND: [
            {
              OR: [
                { isActive: true },
                { id: { in: rows.map((row) => row.recipient.id) } },
              ],
            },
            {
              OR: [
                { homeCareEndedOn: null },
                { homeCareEndedOn: { gte: toDbDate(`${query.month}-01`)! } },
              ],
            },
          ],
        },
        select: homeCareRecipientSelect,
        orderBy: { name: "asc" },
      }),
      // 같은 기관의 그달 장기요양 방문간호(재택의료센터 간호사 방문과 같은 날이면 산정하지 않는다)
      this.prisma.visit.findMany({
        where: filterWhere(actor, { ...filter, program: "LTC_NURSING" }, range),
        select: { recipientId: true, scheduledAt: true },
      }),
      // 그달 전 확정 방문을 수급자·한국 날짜·직종별로 센다(달로 묶고 요건을 보는 것은 shared-types).
      this.prisma.visit.groupBy({
        by: ["recipientId", "scheduledDate", "profession"],
        where: filterWhere(
          actor,
          { ...filter, status: "CONFIRMED" },
          { lt: range.gte },
        ),
        _count: { _all: true },
      }),
    ]);

    const ltcNursingDays = new Map<string, ExternalServiceSchedule[]>();
    for (const visit of ltcNursing) {
      const days = ltcNursingDays.get(visit.recipientId) ?? [];
      days.push(ownLtcNursingDay(formatKstDate(visit.scheduledAt)));
      ltcNursingDays.set(visit.recipientId, days);
    }
    const recipients = recipientRows.map((row) =>
      toHomeCareRecipient(row, ltcNursingDays.get(row.id)),
    );

    return {
      visits: rows.map((row) => {
        const item = toVisitCalendarItem(row);
        const startedAt = row.startedAt?.toISOString() ?? null;
        const endedAt = row.endedAt?.toISOString() ?? null;
        return {
          ...item,
          startedAt,
          endedAt,
          facts: homeCareVisitFacts({
            profession: row.profession,
            formIds: item.formIds,
            startedAt,
            endedAt,
            forms: toVisitForms(row.forms),
          }),
        };
      }),
      recipients,
      priorStreaks: homeCarePriorStreaks(
        counts.map((group) => ({
          recipientId: group.recipientId,
          date: fromDbDate(group.scheduledDate),
          profession: group.profession,
          count: group._count._all,
        })),
        query.month,
        new Map(recipients.map((recipient) => [recipient.id, recipient])),
      ),
      feeSet,
    };
  }
}
