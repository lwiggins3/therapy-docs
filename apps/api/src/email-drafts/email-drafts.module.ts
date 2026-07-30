import { Module } from "@nestjs/common";
import { GmailModule } from "../gmail/gmail.module";
import { EmailDraftsController } from "./email-drafts.controller";
import { EmailDraftsService } from "./email-drafts.service";

@Module({
  imports: [GmailModule],
  controllers: [EmailDraftsController],
  providers: [EmailDraftsService],
})
export class EmailDraftsModule {}
