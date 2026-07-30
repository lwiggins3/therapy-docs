import { BadRequestException, Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { PatientsService } from "./patients.service";

@Controller("patients")
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  async create(
    @Headers("x-therapist-id") therapistId: string,
    @Body("displayName") displayName: string,
    @Body("externalMrn") externalMrn: string | undefined,
  ) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    if (!displayName) {
      throw new BadRequestException("Missing displayName");
    }
    return this.patientsService.createPatient({ therapistId, displayName, externalMrn });
  }

  @Get()
  async list(@Headers("x-therapist-id") therapistId: string) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    return this.patientsService.listPatients(therapistId);
  }
}
