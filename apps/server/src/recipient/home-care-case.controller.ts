import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateHomeCareAssessmentSchema,
  ExternalServiceSchema,
  SetHomeCareEndSchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { AccessLog, fromParam } from "../access-log/access-log.decorator.js";
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
  @AccessLog("VIEW", "재택의료 사례 정보", fromParam("recipient"))
  get(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.homeCareCaseService.get(actor, id);
  }

  @Post(":id/assessments")
  @AccessLog("CREATE", "포괄평가 기록", fromParam("recipient"))
  addAssessment(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: CreateHomeCareAssessmentDto,
  ) {
    return this.homeCareCaseService.addAssessment(actor, id, dto);
  }

  @Delete(":id/assessments/:assessmentId")
  @AccessLog("DELETE", "포괄평가 기록 삭제", fromParam("recipient"))
  removeAssessment(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @UuidParam("assessmentId") assessmentId: string,
  ) {
    return this.homeCareCaseService.removeAssessment(actor, id, assessmentId);
  }

  @Post(":id/external-services")
  @AccessLog("CREATE", "다른 기관 서비스 등록", fromParam("recipient"))
  addExternalService(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: ExternalServiceDto,
  ) {
    return this.homeCareCaseService.addExternalService(actor, id, dto);
  }

  @Put(":id/external-services/:serviceId")
  @AccessLog("UPDATE", "다른 기관 서비스 수정", fromParam("recipient"))
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
  @AccessLog("DELETE", "다른 기관 서비스 삭제", fromParam("recipient"))
  removeExternalService(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @UuidParam("serviceId") serviceId: string,
  ) {
    return this.homeCareCaseService.removeExternalService(actor, id, serviceId);
  }

  /** 재택의료 종결 날짜·사유를 적거나 지운다(둘 다 null). */
  @Put(":id/home-care-end")
  @AccessLog("UPDATE", "재택의료 종결", fromParam("recipient"))
  setEnd(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: SetHomeCareEndDto,
  ) {
    return this.homeCareCaseService.setEnd(actor, id, dto);
  }
}
