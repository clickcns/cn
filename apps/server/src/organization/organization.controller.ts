import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
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
  list() {
    return this.organizationService.list();
  }

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Patch(":id")
  update(@UuidParam() id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(id, dto);
  }
}
