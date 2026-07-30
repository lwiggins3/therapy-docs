import { BadRequestException, Body, Controller, Get, Headers, Post, Query } from "@nestjs/common";
import { EmailDraftsService } from "./email-drafts.service";

@Controller("email-drafts")
export class EmailDraftsController {
  constructor(private readonly emailDraftsService: EmailDraftsService) {}

  @Post()
  async finalize(@Headers("x-therapist-id") therapistId: string, @Body("transcriptId") transcriptId: string) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    if (!transcriptId) {
      throw new BadRequestException("Missing transcriptId");
    }
    return this.emailDraftsService.finalize({ transcriptId, therapistId });
  }

  @Get()
  async list(@Query("transcriptId") transcriptId: string) {
    if (!transcriptId) {
      throw new BadRequestException("Missing transcriptId query param");
    }
    return this.emailDraftsService.listForTranscript(transcriptId);
  }
}
