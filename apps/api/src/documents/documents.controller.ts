import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DocumentsService, type UpdateTagsInput } from "./documents.service";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("title") title: string,
    @Headers("x-therapist-id") therapistId: string,
  ) {
    if (!file) {
      throw new BadRequestException("Missing file");
    }
    if (file.mimetype !== "application/pdf") {
      throw new BadRequestException("Only PDF files are supported");
    }
    if (!title) {
      throw new BadRequestException("Missing title");
    }
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    return this.documentsService.uploadDocument({ therapistId, title, file });
  }

  @Get()
  async list(@Headers("x-therapist-id") therapistId: string) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    return this.documentsService.listDocuments(therapistId);
  }

  @Patch(":id/tags")
  async updateTags(
    @Param("id") id: string,
    @Headers("x-therapist-id") therapistId: string,
    @Body() body: UpdateTagsInput,
  ) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    return this.documentsService.updateTags(id, therapistId, body);
  }
}
