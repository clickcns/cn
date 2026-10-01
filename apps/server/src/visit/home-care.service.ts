import { Injectable } from "@nestjs/common";
import {
  HOME_CARE_REVENUE_FORM_IDS,
  homeCarePriorStreaks,
  homeCareVisitFacts,
  kstMonthRange,
  VISIT_CALENDAR_MAX_ITEMS,
  type HomeCareMonthQuerySchema,
  type HomeCareMonthResponse,
} from "@repo/shared-types";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { fromDbDate } from "../core/utils/db-date.js";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/index.js";
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
 * (컨트롤러 @Roles). 두 조회 모두 방문 목록과 같은 범위(filterWhere)다.
 */
@Injectable()
export class HomeCareService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 그달 재택의료센터 방문(모든 상태, 서식 값 대신 금액 셈에 쓰는 사실만)과, 수급자별로 그달 직전까지
   * 기본료 요건을 확정 기록으로 이어서 채운 달 수(지속관리료). 방문이 상한을 넘으면(운영자의 전체
   * 기관 보기) 연속 개월은 세지 않는다.
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
    const rows = await this.prisma.visit.findMany({
      ...monthVisitArgs,
      where: filterWhere(actor, filter, range),
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      take: VISIT_CALENDAR_MAX_ITEMS + 1,
    });
    if (rows.length > VISIT_CALENDAR_MAX_ITEMS) {
      return { visits: null, priorStreaks: {} };
    }
    // 그달 전 확정 방문을 수급자·한국 날짜·직종별로 센다(달로 묶고 요건을 보는 것은 shared-types).
    const counts = await this.prisma.visit.groupBy({
      by: ["recipientId", "scheduledDate", "profession"],
      where: filterWhere(
        actor,
        { ...filter, status: "CONFIRMED" },
        { lt: range.gte },
      ),
      _count: { _all: true },
    });
    return {
      visits: rows.map((row) => {
        const item = toVisitCalendarItem(row);
        return {
          ...item,
          facts: homeCareVisitFacts({
            profession: row.profession,
            formIds: item.formIds,
            startedAt: row.startedAt?.toISOString() ?? null,
            endedAt: row.endedAt?.toISOString() ?? null,
            forms: toVisitForms(row.forms),
          }),
        };
      }),
      priorStreaks: homeCarePriorStreaks(
        counts.map((group) => ({
          recipientId: group.recipientId,
          date: fromDbDate(group.scheduledDate),
          profession: group.profession,
          count: group._count._all,
        })),
        query.month,
      ),
    };
  }
}
