import { config as loadDotenv } from "dotenv";

loadDotenv({ quiet: true });

/**
 * @returns {{ url: string; databaseName: string }}
 */
function resolveMongoTarget() {
  const databaseNameFallback = process.env.MONGODB_DB_NAME?.trim() || "mayday";
  const uriFallback =
    process.env.MONGODB_URI?.trim()?.replace(/\/+$/, "") || "mongodb://127.0.0.1:27017";
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return { url: uriFallback, databaseName: databaseNameFallback };
  }

  const withoutQuery = databaseUrl.split("?")[0];
  const protocolMatch = withoutQuery.match(/^(mongodb(?:\+srv)?:\/\/)/u);
  if (!protocolMatch) {
    throw new Error("DATABASE_URL must start with mongodb:// or mongodb+srv://");
  }
  const afterProtocol = withoutQuery.slice(protocolMatch[1].length);
  const pathSlash = afterProtocol.indexOf("/");
  if (pathSlash === -1 || pathSlash === afterProtocol.length - 1) {
    return { url: withoutQuery.replace(/\/+$/, ""), databaseName: databaseNameFallback };
  }
  const hostPart = afterProtocol.slice(0, pathSlash);
  const dbFromPath = afterProtocol.slice(pathSlash + 1);
  return {
    url: `${protocolMatch[1]}${hostPart}`,
    databaseName: dbFromPath || databaseNameFallback,
  };
}

const { url, databaseName } = resolveMongoTarget();

const config = {
  mongodb: {
    url,
    databaseName,
    options: {},
  },
  migrationsDir: "mongo/migrations",
  changelogCollectionName: process.env.MONGO_MIGRATE_CHANGELOG_NAME || "mongo_migrate_changelog",
  lockCollectionName: "mongo_migrate_lock",
  lockTtl: 0,
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: "esm",
};

export default config;
