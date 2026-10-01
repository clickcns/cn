import { Module } from "@nestjs/common";
import { RecipientRecordsController } from "./recipient-records.controller.js";
import { VisitController } from "./visit.controller.js";
import { VisitService } from "./visit.service.js";

@Module({
  controllers: [VisitController, RecipientRecordsController],
  providers: [VisitService],
  exports: [VisitService],
})
export class VisitModule {}
