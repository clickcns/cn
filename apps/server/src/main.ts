import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import compression from "compression";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { ConfigService } from "./config/index.js";
import { setupSwagger } from "./core/setup/swagger.setup.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);

  // 요청 제한(throttler)이 보는 클라이언트 IP를 정한다. 설명은 config.service의 TRUST_PROXY.
  app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use(compression());
  app.enableCors();
  app.setGlobalPrefix("api");
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  if (!config.isProduction) {
    setupSwagger(app);
  }

  await app.listen(config.port);
}
void bootstrap();
