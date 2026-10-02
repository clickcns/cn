import { Module } from "@nestjs/common";
import { FeeScheduleModule } from "../fee-schedule/fee-schedule.module.js";
import { HomeCareService } from "./home-care.service.js";
import { PortalEntryService } from "./portal-entry.service.js";
import { RecipientRecordsController } from "./recipient-records.controller.js";
import { VisitController } from "./visit.controller.js";
import { VisitService } from "./visit.service.js";

@Module({
  imports: [FeeScheduleModule],
  controllers: [VisitController, RecipientRecordsController],
  providers: [VisitService, PortalEntryService, HomeCareService],
  exports: [VisitService],
})
export class VisitModule {}
