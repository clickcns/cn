import { Provider } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ZodValidationPipe } from "nestjs-zod";
import { JwtAuthGuard, RolesGuard } from "../../auth/guards/index.js";
import { ErrorFilter } from "../filters/error.filter.js";

/** 등록 순서대로 실행된다: 요청 제한 → 인증 → 역할 확인. */
export const globalProviders: Provider[] = [
  { provide: APP_PIPE, useClass: ZodValidationPipe },
  { provide: APP_FILTER, useClass: ErrorFilter },
  { provide: APP_GUARD, useClass: ThrottlerGuard },
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
];
