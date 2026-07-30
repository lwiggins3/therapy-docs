import { BadRequestException, Injectable } from "@nestjs/common";
import { db } from "@therapy-docs/db";
import { google } from "googleapis";
import { createSignedState, verifySignedState } from "../lib/signed-state";
import { createTokenStore, type TokenStore, type TokenStoreProvider } from "../lib/token-store";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

@Injectable()
export class GmailService {
  private readonly tokenStore: TokenStore;
  private readonly stateSecret: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    this.tokenStore = createTokenStore({
      provider: (process.env.TOKEN_STORE_PROVIDER as TokenStoreProvider) ?? "local",
      projectId: process.env.GCP_PROJECT_ID,
      localDir: process.env.LOCAL_STORAGE_DIR,
    });
    this.stateSecret = process.env.OAUTH_STATE_SECRET ?? "";
    this.clientId = process.env.GMAIL_OAUTH_CLIENT_ID ?? "";
    this.clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET ?? "";
    this.redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI ?? "";
  }

  private createOAuth2Client() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
  }

  getAuthUrl(therapistId: string): string {
    const oauth2Client = this.createOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: "offline", // required to get a refresh_token back
      prompt: "consent", // ensures a refresh_token is returned even on a repeat consent
      scope: [GMAIL_SCOPE],
      state: createSignedState(therapistId, this.stateSecret),
    });
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const { therapistId } = verifySignedState(state, this.stateSecret);

    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      throw new BadRequestException(
        "Google did not return a refresh token — the therapist may need to revoke prior access at " +
          "https://myaccount.google.com/permissions and reconnect",
      );
    }

    const { ref } = await this.tokenStore.save(therapistId, tokens.refresh_token);
    await db.therapist.update({
      where: { id: therapistId },
      data: { gmailConnected: true, gmailTokenRef: ref },
    });
  }

  async getStatus(therapistId: string): Promise<{ connected: boolean }> {
    const therapist = await db.therapist.findUniqueOrThrow({ where: { id: therapistId } });
    return { connected: therapist.gmailConnected };
  }

  /** Builds an authenticated Gmail API client for a therapist who has already connected Gmail. */
  async getAuthorizedGmailClient(therapistId: string) {
    const therapist = await db.therapist.findUniqueOrThrow({ where: { id: therapistId } });
    if (!therapist.gmailConnected || !therapist.gmailTokenRef) {
      throw new BadRequestException("Therapist has not connected Gmail yet");
    }

    const refreshToken = await this.tokenStore.load(therapist.gmailTokenRef);
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    return google.gmail({ version: "v1", auth: oauth2Client });
  }
}
