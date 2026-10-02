import { Module } from "@nestjs/common";
import { FeeScheduleController } from "./fee-schedule.controller.js";
import { FeeScheduleService } from "./fee-schedule.service.js";

@Module({
  controllers: [FeeScheduleController],
  providers: [FeeScheduleService],
  exports: [FeeScheduleService],
})
export class FeeScheduleModule {}
