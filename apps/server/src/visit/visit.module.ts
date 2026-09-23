import { Module } from "@nestjs/common";
import { VisitController } from "./visit.controller.js";
import { VisitService } from "./visit.service.js";

@Module({
  controllers: [VisitController],
  providers: [VisitService],
  exports: [VisitService],
})
export class VisitModule {}
