import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  PreviewFormLayoutSchema,
  SaveFormLayoutSchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { FormLayoutService } from "./form-layout.service.js";

class SaveFormLayoutDto extends createZodDto(SaveFormLayoutSchema) {}
class PreviewFormLayoutDto extends createZodDto(PreviewFormLayoutSchema) {}

/** 원본 서식 조정(칸 자리·글자 모양). 모든 기관에 적용되므로 운영자만 쓴다. */
@ApiTags("form-layouts")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("form-layouts")
export class FormLayoutController {
  constructor(private readonly formLayoutService: FormLayoutService) {}

  @Get()
  list() {
    return this.formLayoutService.list();
  }

  @Get(":formId")
  detail(@Param("formId") formId: string) {
    return this.formLayoutService.detail(formId);
  }

  @Put(":formId")
  save(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("formId") formId: string,
    @Body() dto: SaveFormLayoutDto,
  ) {
    return this.formLayoutService.save(actor, formId, dto);
  }

  @Delete(":formId")
  reset(@Param("formId") formId: string) {
    return this.formLayoutService.reset(formId);
  }

  /** 저장하지 않은 조정으로 그린 표본 PDF(조정 화면 미리보기). */
  @Post(":formId/preview")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async preview(
    @Param("formId") formId: string,
    @Body() dto: PreviewFormLayoutDto,
  ): Promise<StreamableFile> {
    return new StreamableFile(
      await this.formLayoutService.preview(formId, dto.adjustments),
      { type: "application/pdf" },
    );
  }
}
