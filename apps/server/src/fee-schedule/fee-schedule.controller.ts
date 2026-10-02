import { Body, Controller, Delete, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateHomeCareFeeScheduleSchema } from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { FeeScheduleService } from "./fee-schedule.service.js";

class CreateHomeCareFeeScheduleDto extends createZodDto(
  CreateHomeCareFeeScheduleSchema,
) {}

/**
 * 재택의료 수입의 수가 묶음. 보기는 기관 관리자·운영자, 넣기·지우기는 운영자만(모든 기관 공통).
 * 넣고 지우면 목록 전체를 돌려준다.
 */
@ApiTags("home-care-fee-schedules")
@ApiBearerAuth()
@Controller("home-care-fee-schedules")
export class FeeScheduleController {
  constructor(private readonly feeScheduleService: FeeScheduleService) {}

  @Get()
  @Roles("ADMIN", "MANAGER")
  list() {
    return this.feeScheduleService.list();
  }

  @Post()
  @Roles("ADMIN")
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateHomeCareFeeScheduleDto,
  ) {
    return this.feeScheduleService.create(actor, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  remove(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.feeScheduleService.remove(actor, id);
  }
}
