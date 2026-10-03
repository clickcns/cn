import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import {
  AccessLog,
  fromParam,
  fromResult,
  NoAccessLog,
} from "../access-log/access-log.decorator.js";
import { Roles } from "../auth/decorators/index.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { OrganizationService } from "./organization.service.js";

class CreateOrganizationDto extends createZodDto(CreateOrganizationSchema) {}
class UpdateOrganizationDto extends createZodDto(UpdateOrganizationSchema) {}

/** 기관 관리는 운영자 전용이다. */
@ApiTags("organizations")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("organizations")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @NoAccessLog("기관 목록: 개인정보를 다루지 않는다")
  list() {
    return this.organizationService.list();
  }

  @Post()
  @AccessLog("CREATE", "기관 등록", fromResult("organization"))
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Patch(":id")
  @AccessLog("UPDATE", "기관 정보 수정", fromParam("organization"))
  update(@UuidParam() id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(id, dto);
  }
}
