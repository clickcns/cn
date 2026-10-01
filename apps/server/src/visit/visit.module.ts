import { Module } from "@nestjs/common";
import { PortalEntryService } from "./portal-entry.service.js";
import { RecipientRecordsController } from "./recipient-records.controller.js";
import { VisitController } from "./visit.controller.js";
import { VisitService } from "./visit.service.js";

@Module({
  controllers: [VisitController, RecipientRecordsController],
  providers: [VisitService, PortalEntryService],
  exports: [VisitService],
})
export class VisitModule {}
