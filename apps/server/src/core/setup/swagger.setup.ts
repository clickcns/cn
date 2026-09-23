import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

/** 개발 환경에서만 /api/swagger 에 API 문서를 띄운다. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("CareNote API")
    .setDescription("방문간호 기록 도우미 API")
    .setVersion("0.1")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/swagger", app, cleanupOpenApiDoc(document));
}
