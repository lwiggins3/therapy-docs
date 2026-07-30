import { Injectable } from "@nestjs/common";
import { db } from "@therapy-docs/db";

@Injectable()
export class PatientsService {
  async createPatient(input: { therapistId: string; displayName: string; externalMrn?: string }) {
    return db.patient.create({
      data: {
        therapistId: input.therapistId,
        displayName: input.displayName,
        externalMrn: input.externalMrn,
      },
    });
  }

  async listPatients(therapistId: string) {
    return db.patient.findMany({
      where: { therapistId },
      orderBy: { createdAt: "desc" },
    });
  }
}
