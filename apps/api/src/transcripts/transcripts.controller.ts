import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { TranscriptsService } from "./transcripts.service";

@Controller("transcripts")
export class TranscriptsController {
  constructor(private readonly transcriptsService: TranscriptsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("patientId") patientId: string,
    @Body("sessionDate") sessionDate: string | undefined,
    @Headers("x-therapist-id") therapistId: string,
  ) {
    if (!file) {
      throw new BadRequestException("Missing file");
    }
    if (file.mimetype !== "application/pdf") {
      throw new BadRequestException("Only PDF files are supported");
    }
    if (!patientId) {
      throw new BadRequestException("Missing patientId");
    }
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    return this.transcriptsService.uploadTranscript({ therapistId, patientId, sessionDate, file });
  }

  @Get()
  async list(
    @Headers("x-therapist-id") therapistId: string,
    @Query("patientId") patientId: string | undefined,
  ) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    return this.transcriptsService.listTranscripts(therapistId, patientId);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const transcript = await this.transcriptsService.getTranscript(id);
    if (!transcript) {
      throw new NotFoundException(`Transcript not found: ${id}`);
    }
    return transcript;
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string, @Headers("x-therapist-id") therapistId: string) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    await this.transcriptsService.deleteTranscript(id, therapistId);
  }
}
