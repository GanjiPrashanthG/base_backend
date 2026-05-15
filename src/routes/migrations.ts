import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import type { Env } from "../config.js";
import { API_MIGRATIONS_PATH } from "../constants.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { readMigrationChangelog } from "../lib/migrationChangelog.js";
import { requireAdminKey } from "../middleware/requireAdminKey.js";

export function createMigrationsRouter(prisma: PrismaClient, env: Pick<Env, "NODE_ENV" | "ADMIN_API_KEY" | "MONGO_MIGRATE_CHANGELOG_NAME">) {
  const router = Router();
  router.use(requireAdminKey(env));
  router.get(
    API_MIGRATIONS_PATH,
    asyncHandler(async (_req, res) => {
      const migrations = await readMigrationChangelog(prisma, env.MONGO_MIGRATE_CHANGELOG_NAME);
      res.json({
        collection: env.MONGO_MIGRATE_CHANGELOG_NAME,
        migrations,
      });
    }),
  );
  return router;
}
