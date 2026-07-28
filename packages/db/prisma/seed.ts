import { db } from "../src/index";

/**
 * Seeds a single dev Therapist so apps/api has someone to attach documents/patients to before
 * real identity (IAP) is wired up — see the `/dev/therapist` endpoint in apps/api and
 * docs/roadmap.md item 2. Idempotent: safe to run repeatedly.
 */
async function main() {
  const therapist = await db.therapist.upsert({
    where: { email: "dev@example.com" },
    update: {},
    create: { email: "dev@example.com", displayName: "Dev Therapist" },
  });
  console.log(`Seeded dev therapist: ${therapist.id} (${therapist.email})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
