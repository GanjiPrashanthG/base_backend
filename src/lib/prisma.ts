import { PrismaClient } from "@prisma/client";

export function createPrismaClient(databaseUrl: string, nodeEnv: string): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });
}
