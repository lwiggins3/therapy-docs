import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DevController } from "./dev/dev.controller";
import { DocumentsModule } from "./documents/documents.module";
import { PatientsModule } from "./patients/patients.module";
import { RecommendationsModule } from "./recommendations/recommendations.module";
import { TranscriptsModule } from "./transcripts/transcripts.module";

// Future modules: EmailDraftsModule.
@Module({
  imports: [DocumentsModule, PatientsModule, TranscriptsModule, RecommendationsModule],
  controllers: [AppController, DevController],
  providers: [],
})
export class AppModule {}
