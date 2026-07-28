import { Controller, Get } from "@nestjs/common";
import { DocumentsService } from "./documents.service";

@Controller("tags")
export class TagsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async list() {
    return this.documentsService.listTags();
  }
}
