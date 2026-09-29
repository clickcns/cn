import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { ConfigModule, getPinoHttpConfig } from "./config/index.js";
import { DictationModule } from "./dictation/dictation.module.js";
import { FormPdfModule } from "./form-pdf/form-pdf.module.js";
import { globalProviders } from "./core/providers/global.providers.js";
import { OrganizationModule } from "./organization/organization.module.js";
import { PrismaModule } from "./prisma/index.js";
import { RecipientModule } from "./recipient/recipient.module.js";
import { UserModule } from "./user/user.module.js";
import { VisitModule } from "./visit/visit.module.js";

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({ pinoHttp: getPinoHttpConfig() }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 300 }],
      errorMessage: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요",
    }),
    PrismaModule,
    AuthModule,
    OrganizationModule,
    UserModule,
    RecipientModule,
    VisitModule,
    FormPdfModule,
    DictationModule,
  ],
  controllers: [AppController],
  providers: [...globalProviders],
})
export class AppModule {}
