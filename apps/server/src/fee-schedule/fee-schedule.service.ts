import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  DEFAULT_HOME_CARE_FEE_SET,
  parseStoredFees,
  scheduleForMonth,
  type CreateHomeCareFeeScheduleSchema,
  type HomeCareFees,
  type HomeCareFeeSchedule,
  type HomeCareFeeScheduleList,
  type HomeCareFeeSet,
} from "@repo/shared-types";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import type { Prisma } from "../generated/prisma/client.js";
import { handlePrismaError, PrismaService } from "../prisma/index.js";
import { actorSelect } from "../user/user.mapper.js";

const scheduleArgs = {
  include: { createdBy: actorSelect, deletedBy: actorSelect },
} as const satisfies Prisma.HomeCareFeeScheduleDefaultArgs;

type ScheduleRow = Prisma.HomeCareFeeScheduleGetPayload<typeof scheduleArgs>;

/** 저장한 묶음 읽기. 형식이 깨졌으면 조용히 기본값을 쓰지 않고 500으로 알린다(돈 계산이라). */
function feesOf(row: { id: string; fees: Prisma.JsonValue }): HomeCareFees {
  const fees = parseStoredFees(row.fees);
  if (!fees) {
    throw new InternalServerErrorException(
      `수가 묶음(${row.id})의 값을 읽을 수 없습니다`,
    );
  }
  return fees;
}

function toSchedule(row: ScheduleRow): HomeCareFeeSchedule {
  return {
    id: row.id,
    effectiveMonth: row.effectiveMonth,
    fees: feesOf(row),
    source: row.source,
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    deletedBy: row.deletedBy,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

/**
 * 재택의료 수입의 수가 묶음(shared-types fee-schedule.ts). 넣기·지우기는 운영자만(컨트롤러 @Roles),
 * 모든 기관 공통이다. 고치지 않고 새로 넣으며, 지우면 deletedAt만 붙여 이력에 남긴다.
 */
@Injectable()
export class FeeScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<HomeCareFeeScheduleList> {
    const rows = await this.prisma.homeCareFeeSchedule.findMany({
      ...scheduleArgs,
      orderBy: [{ effectiveMonth: "desc" }, { createdAt: "desc" }],
    });
    return {
      defaults: DEFAULT_HOME_CARE_FEE_SET,
      schedules: rows.map(toSchedule),
    };
  }

  /** 그달에 쓰는 수가(scheduleForMonth — 묶음은 몇 개뿐이라 지우지 않은 것을 모두 읽는다). */
  async forMonth(month: string): Promise<HomeCareFeeSet> {
    const rows = await this.prisma.homeCareFeeSchedule.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        effectiveMonth: true,
        deletedAt: true,
        fees: true,
        source: true,
      },
    });
    const row = scheduleForMonth(rows, month);
    return row
      ? { fees: feesOf(row), source: row.source }
      : DEFAULT_HOME_CARE_FEE_SET;
  }

  /** 시행 월마다 지우지 않은 묶음은 하나다(부분 유니크 인덱스, 먼저 지우고 다시 넣는다). */
  async create(
    actor: AuthenticatedUser,
    {
      effectiveMonth,
      fees,
      source,
      note,
    }: z.output<typeof CreateHomeCareFeeScheduleSchema>,
  ): Promise<HomeCareFeeScheduleList> {
    await this.prisma.homeCareFeeSchedule
      .create({
        data: { effectiveMonth, fees, source, note, createdById: actor.id },
      })
      .catch((error: unknown) =>
        handlePrismaError(error, {
          conflict: `${effectiveMonth} 시행 수가가 이미 있습니다. 고치려면 그 묶음을 지우고 다시 넣어 주세요`,
        }),
      );
    return this.list();
  }

  async remove(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<HomeCareFeeScheduleList> {
    const { count } = await this.prisma.homeCareFeeSchedule.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: actor.id },
    });
    if (count === 0) {
      throw new NotFoundException(
        "수가 묶음을 찾을 수 없습니다(이미 지웠을 수 있습니다)",
      );
    }
    return this.list();
  }
}
