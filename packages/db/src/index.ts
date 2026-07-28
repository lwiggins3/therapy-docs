import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client singleton. Import `db` from apps/api and apps/worker rather than
 * instantiating PrismaClient directly, so both share one connection pool configuration.
 */
export const db = new PrismaClient();

export * from "@prisma/client";
