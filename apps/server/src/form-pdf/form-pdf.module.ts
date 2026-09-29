import { Module } from "@nestjs/common";
import { FormPdfController } from "./form-pdf.controller.js";
import { FormPdfService } from "./form-pdf.service.js";

/** 확정본 서식 PDF(원본 위에 채우기·서식 정의로 그리기). */
@Module({
  controllers: [FormPdfController],
  providers: [FormPdfService],
})
export class FormPdfModule {}
