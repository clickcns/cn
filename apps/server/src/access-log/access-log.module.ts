import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AccessLogController } from "./access-log.controller.js";
import { AccessLogInterceptor } from "./access-log.interceptor.js";
import { AccessLogService } from "./access-log.service.js";

/**
 * 접속기록. 시작은 전역 가드 맨 앞의 AccessLogGuard(core/providers/global.providers.ts — 다른 가드보다
 * 먼저 돌아야 해서 거기 둔다), 대상 찾기·응답 값은 전역 인터셉터.
 */
@Module({
  controllers: [AccessLogController],
  providers: [
    AccessLogService,
    { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
  ],
  exports: [AccessLogService],
})
export class AccessLogModule {}
