import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { NoAccessLog } from "./access-log/access-log.decorator.js";
import { Public } from "./auth/decorators/index.js";

@ApiTags("health")
@Controller()
export class AppController {
  /** 로드밸런서·k8s probe용. */
  @Public()
  @SkipThrottle()
  @Get("health")
  @NoAccessLog("서버 상태 확인")
  health() {
    return { status: "ok" };
  }
}
