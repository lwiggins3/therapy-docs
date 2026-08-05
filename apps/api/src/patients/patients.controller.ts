import { BadRequestException, Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { isValidEmail } from "./is-valid-email";
import { PatientsService } from "./patients.service";

@Controller("patients")
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  async create(
    @Headers("x-therapist-id") therapistId: string,
    @Body("displayName") displayName: string,
    @Body("externalMrn") externalMrn: string | undefined,
    @Body("email") email: string | undefined,
  ) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    if (!displayName) {
      throw new BadRequestException("Missing displayName");
    }
    if (email && !isValidEmail(email)) {
      throw new BadRequestException("Invalid email address");
    }
    return this.patientsService.createPatient({ therapistId, displayName, externalMrn, email });
  }

  @Get()
  async list(@Headers("x-therapist-id") therapistId: string) {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    return this.patientsService.listPatients(therapistId);
  }
}
