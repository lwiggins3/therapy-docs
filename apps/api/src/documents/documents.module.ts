import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { TagsController } from "./tags.controller";

@Module({
  controllers: [DocumentsController, TagsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
