import { Controller, Get, NotFoundException } from "@nestjs/common";
import { db } from "@therapy-docs/db";

/**
 * Temporary stand-in for real identity. There's no IAP/auth wired up yet (see
 * docs/roadmap.md item 2) — apps/web calls this once on load to get the seeded dev
 * Therapist's id (see packages/db/prisma/seed.ts), then sends it as `x-therapist-id` on every
 * subsequent request. Delete this whole module once IAP → therapist-by-email lookup exists.
 */
@Controller("dev")
export class DevController {
  @Get("therapist")
  async getDevTherapist(): Promise<{ id: string; email: string; displayName: string }> {
    const therapist = await db.therapist.findUnique({ where: { email: "dev@example.com" } });
    if (!therapist) {
      throw new NotFoundException(
        "No dev therapist seeded yet — run `pnpm --filter @therapy-docs/db seed`",
      );
    }
    return therapist;
  }
}
