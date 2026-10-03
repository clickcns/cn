import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateHomeCareFeeScheduleSchema,
  UpdateHomeCareFeeScheduleSchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { AccessLog, NoAccessLog } from "../access-log/access-log.decorator.js";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { FeeScheduleService } from "./fee-schedule.service.js";

class CreateHomeCareFeeScheduleDto extends createZodDto(
  CreateHomeCareFeeScheduleSchema,
) {}

class UpdateHomeCareFeeScheduleDto extends createZodDto(
  UpdateHomeCareFeeScheduleSchema,
) {}

/**
 * 재택의료 수입의 수가 묶음. 보기는 기관 관리자·운영자, 넣기·고치기·지우기는 운영자만(모든 기관
 * 공통). 바꾸면 목록 전체를 돌려준다.
 */
@ApiTags("home-care-fee-schedules")
@ApiBearerAuth()
@Controller("home-care-fee-schedules")
export class FeeScheduleController {
  constructor(private readonly feeScheduleService: FeeScheduleService) {}

  @Get()
  @Roles("ADMIN", "MANAGER")
  @NoAccessLog("수가: 개인정보를 다루지 않는다")
  list() {
    return this.feeScheduleService.list();
  }

  @Post()
  @Roles("ADMIN")
  @AccessLog("CREATE", "수가 넣기")
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateHomeCareFeeScheduleDto,
  ) {
    return this.feeScheduleService.create(actor, dto);
  }

  @Put(":id")
  @Roles("ADMIN")
  @AccessLog("UPDATE", "수가 고치기")
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: UpdateHomeCareFeeScheduleDto,
  ) {
    return this.feeScheduleService.update(actor, id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @AccessLog("DELETE", "수가 지우기")
  remove(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.feeScheduleService.remove(actor, id);
  }
}
