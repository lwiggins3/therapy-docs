import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DevController } from "./dev/dev.controller";
import { DocumentsModule } from "./documents/documents.module";

// Future modules: TranscriptsModule, RecommendationsModule, EmailDraftsModule.
@Module({
  imports: [DocumentsModule],
  controllers: [AppController, DevController],
  providers: [],
})
export class AppModule {}
