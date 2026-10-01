import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateHomeCareAssessmentSchema,
  ExternalServiceSchema,
  SetHomeCareEndSchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { HomeCareCaseService } from "./home-care-case.service.js";

class CreateHomeCareAssessmentDto extends createZodDto(
  CreateHomeCareAssessmentSchema,
) {}
class ExternalServiceDto extends createZodDto(ExternalServiceSchema) {}
class SetHomeCareEndDto extends createZodDto(SetHomeCareEndSchema) {}

/**
 * 재택의료센터 수급자의 사례 정보: 포괄평가 기록, 다른 기관 서비스 일정, 재택의료 종결.
 * 기관 관리자·운영자만(재택의료 수입 화면에서 적는다). 바꾸면 사례 정보 전체를 돌려준다.
 */
@ApiTags("recipients")
@ApiBearerAuth()
@Controller("recipients")
@Roles("ADMIN", "MANAGER")
export class HomeCareCaseController {
  constructor(private readonly homeCareCaseService: HomeCareCaseService) {}

  @Get(":id/home-care-case")
  get(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.homeCareCaseService.get(actor, id);
  }

  @Post(":id/assessments")
  addAssessment(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: CreateHomeCareAssessmentDto,
  ) {
    return this.homeCareCaseService.addAssessment(actor, id, dto);
  }

  @Delete(":id/assessments/:assessmentId")
  removeAssessment(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @UuidParam("assessmentId") assessmentId: string,
  ) {
    return this.homeCareCaseService.removeAssessment(actor, id, assessmentId);
  }

  @Post(":id/external-services")
  addExternalService(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: ExternalServiceDto,
  ) {
    return this.homeCareCaseService.addExternalService(actor, id, dto);
  }

  @Put(":id/external-services/:serviceId")
  updateExternalService(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @UuidParam("serviceId") serviceId: string,
    @Body() dto: ExternalServiceDto,
  ) {
    return this.homeCareCaseService.updateExternalService(
      actor,
      id,
      serviceId,
      dto,
    );
  }

  @Delete(":id/external-services/:serviceId")
  removeExternalService(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @UuidParam("serviceId") serviceId: string,
  ) {
    return this.homeCareCaseService.removeExternalService(actor, id, serviceId);
  }

  /** 재택의료 종결 날짜·사유를 적거나 지운다(둘 다 null). */
  @Put(":id/home-care-end")
  setEnd(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: SetHomeCareEndDto,
  ) {
    return this.homeCareCaseService.setEnd(actor, id, dto);
  }
}
