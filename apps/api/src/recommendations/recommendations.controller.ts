import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { RecommendationsService, type RecommendationDecision } from "./recommendations.service";

@Controller("recommendations")
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get()
  async list(@Query("transcriptId") transcriptId: string) {
    if (!transcriptId) {
      throw new BadRequestException("Missing transcriptId query param");
    }
    return this.recommendationsService.listForTranscript(transcriptId);
  }

  @Patch(":id")
  async decide(
    @Param("id") id: string,
    @Headers("x-therapist-id") therapistId: string,
    @Body("status") status: RecommendationDecision,
  ) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    if (status !== "accepted" && status !== "rejected") {
      throw new BadRequestException('status must be "accepted" or "rejected"');
    }
    return this.recommendationsService.decide(id, therapistId, status);
  }

  @Post()
  async add(
    @Headers("x-therapist-id") therapistId: string,
    @Body("transcriptId") transcriptId: string,
    @Body("documentId") documentId: string,
  ) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    if (!transcriptId || !documentId) {
      throw new BadRequestException("Missing transcriptId or documentId");
    }
    return this.recommendationsService.addManually({ transcriptId, documentId, therapistId });
  }
}
