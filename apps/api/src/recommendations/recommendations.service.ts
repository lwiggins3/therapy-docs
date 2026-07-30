import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { db } from "@therapy-docs/db";

export type RecommendationDecision = "accepted" | "rejected";

@Injectable()
export class RecommendationsService {
  async listForTranscript(transcriptId: string) {
    return db.recommendation.findMany({
      where: { transcriptId },
      include: { document: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async decide(id: string, therapistId: string, status: RecommendationDecision) {
    const recommendation = await db.recommendation.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!recommendation) {
      throw new NotFoundException(`Recommendation not found: ${id}`);
    }
    if (recommendation.patient.therapistId !== therapistId) {
      throw new ForbiddenException("Recommendation belongs to a different therapist");
    }

    return db.recommendation.update({
      where: { id },
      data: { status, decidedAt: new Date() },
      include: { document: true },
    });
  }

  async addManually(input: { transcriptId: string; documentId: string; therapistId: string }) {
    const transcript = await db.transcript.findUnique({ where: { id: input.transcriptId } });
    if (!transcript) {
      throw new NotFoundException(`Transcript not found: ${input.transcriptId}`);
    }
    if (transcript.therapistId !== input.therapistId) {
      throw new ForbiddenException("Transcript belongs to a different therapist");
    }

    return db.recommendation.create({
      data: {
        transcriptId: input.transcriptId,
        patientId: transcript.patientId,
        documentId: input.documentId,
        status: "added_by_therapist",
        decidedAt: new Date(),
      },
      include: { document: true },
    });
  }
}
