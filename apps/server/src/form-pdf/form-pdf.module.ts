import { Module } from "@nestjs/common";
import { FormLayoutController } from "./form-layout.controller.js";
import { FormLayoutService } from "./form-layout.service.js";
import { FormPdfController } from "./form-pdf.controller.js";
import { FormPdfService } from "./form-pdf.service.js";

/** 확정본 서식 PDF(원본 위에 채우기·서식 정의로 그리기)와 원본 서식 조정. */
@Module({
  controllers: [FormPdfController, FormLayoutController],
  providers: [FormPdfService, FormLayoutService],
})
export class FormPdfModule {}
