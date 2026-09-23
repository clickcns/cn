import { Module } from "@nestjs/common";
import { RecipientController } from "./recipient.controller.js";
import { RecipientService } from "./recipient.service.js";

@Module({
  controllers: [RecipientController],
  providers: [RecipientService],
})
export class RecipientModule {}
