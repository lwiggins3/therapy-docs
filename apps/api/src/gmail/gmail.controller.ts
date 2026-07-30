import { BadRequestException, Controller, Get, Headers, Query, Redirect } from "@nestjs/common";
import { GmailService } from "./gmail.service";

@Controller("gmail")
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  @Get("auth-url")
  authUrl(@Headers("x-therapist-id") therapistId: string): { url: string } {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    return { url: this.gmailService.getAuthUrl(therapistId) };
  }

  @Get("callback")
  @Redirect()
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
  ): Promise<{ url: string }> {
    if (!code || !state) {
      throw new BadRequestException("Missing code or state query param");
    }
    await this.gmailService.handleCallback(code, state);
    const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:3000";
    return { url: `${webAppUrl}/settings?gmail=connected` };
  }

  @Get("status")
  async status(@Headers("x-therapist-id") therapistId: string): Promise<{ connected: boolean }> {
    if (!therapistId) {
      throw new BadRequestException("Missing x-therapist-id header");
    }
    return this.gmailService.getStatus(therapistId);
  }
}
