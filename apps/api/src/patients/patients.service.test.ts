import { randomUUID } from "node:crypto";
import { db } from "@therapy-docs/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PatientsService } from "./patients.service";

describe("PatientsService.createPatient", () => {
  let therapistId: string;
  let service: PatientsService;
  const patientIds: string[] = [];

  beforeAll(async () => {
    const therapist = await db.therapist.create({
      data: { email: `test-${randomUUID()}@example.com`, displayName: "Test Therapist" },
    });
    therapistId = therapist.id;
    service = new PatientsService();
  });

  afterEach(async () => {
    await db.patient.deleteMany({ where: { id: { in: patientIds } } });
    patientIds.length = 0;
  });

  afterAll(async () => {
    await db.therapist.delete({ where: { id: therapistId } });
    await db.$disconnect();
  });

  it("persists the email address when provided", async () => {
    const patient = await service.createPatient({
      therapistId,
      displayName: "Test Patient",
      email: "patient@example.com",
    });
    patientIds.push(patient.id);

    expect(patient.email).toBe("patient@example.com");
  });

  it("leaves email null when omitted", async () => {
    const patient = await service.createPatient({ therapistId, displayName: "Test Patient" });
    patientIds.push(patient.id);

    expect(patient.email).toBeNull();
  });
});
