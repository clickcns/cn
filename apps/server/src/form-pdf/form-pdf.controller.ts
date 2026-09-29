import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  FormPdfQuerySchema,
  NurseMonthPdfQuerySchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { FormPdfService, type PdfFile } from "./form-pdf.service.js";

class FormPdfQueryDto extends createZodDto(FormPdfQuerySchema) {}
class NurseMonthPdfQueryDto extends createZodDto(NurseMonthPdfQuerySchema) {}

/**
 * 브라우저에서 바로 열리게(inline) 보내고, 한글 파일 이름은 RFC 5987로 붙인다(웹이 이 이름을 읽는다).
 * 대상자 기록이라 브라우저·프록시에 남기지 않는다(no-store).
 */
function pdfResponse(file: PdfFile): StreamableFile {
  return new StreamableFile(file.bytes, {
    type: "application/pdf",
    disposition: `inline; filename="form.pdf"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  });
}

@ApiTags("form-pdf")
@ApiBearerAuth()
@Controller()
export class FormPdfController {
  constructor(private readonly formPdfService: FormPdfService) {}

  /** 확정본 한 벌의 서식 PDF(style=original: 원본 위에 채움, standard: 서식 정의로 그림). */
  @Get("visits/:id/versions/:version/pdf")
  @Header("Cache-Control", "no-store")
  async visitVersionPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Param("version", ParseIntPipe) version: number,
    @Query() query: FormPdfQueryDto,
  ): Promise<StreamableFile> {
    return pdfResponse(
      await this.formPdfService.visitVersionPdf(
        actor,
        id,
        version,
        query.style,
      ),
    );
  }

  /** 제7호 월간 기록지(수급자·달). 다른 직원 방문이 들어가 기관 관리자·운영자만. */
  @Roles("ADMIN", "MANAGER")
  @Get("recipients/:id/home-care-nurse-pdf")
  @Header("Cache-Control", "no-store")
  async nurseMonthPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Query() query: NurseMonthPdfQueryDto,
  ): Promise<StreamableFile> {
    return pdfResponse(
      await this.formPdfService.nurseMonthPdf(actor, id, query.month),
    );
  }
}
