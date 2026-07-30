import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DevController } from "./dev/dev.controller";
import { DocumentsModule } from "./documents/documents.module";
import { EmailDraftsModule } from "./email-drafts/email-drafts.module";
import { GmailModule } from "./gmail/gmail.module";
import { PatientsModule } from "./patients/patients.module";
import { RecommendationsModule } from "./recommendations/recommendations.module";
import { TranscriptsModule } from "./transcripts/transcripts.module";

@Module({
  imports: [
    DocumentsModule,
    PatientsModule,
    TranscriptsModule,
    RecommendationsModule,
    GmailModule,
    EmailDraftsModule,
  ],
  controllers: [AppController, DevController],
  providers: [],
})
export class AppModule {}
