import { Module } from "@nestjs/common";
import { HomeCareCaseController } from "./home-care-case.controller.js";
import { HomeCareCaseService } from "./home-care-case.service.js";
import { RecipientController } from "./recipient.controller.js";
import { RecipientService } from "./recipient.service.js";

@Module({
  controllers: [RecipientController, HomeCareCaseController],
  providers: [RecipientService, HomeCareCaseService],
})
export class RecipientModule {}
