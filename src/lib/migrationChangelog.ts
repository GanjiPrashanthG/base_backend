import { Prisma, type PrismaClient } from "@prisma/client";

export type MigrationChangelogRow = {
  fileName: string;
  appliedAt: string | "PENDING" | null;
};

function serializeAppliedAt(value: unknown): string | "PENDING" | null {
  if (value === "PENDING" || value === "pending") {
    return "PENDING";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "$date" in value) {
    const inner = (value as { $date: unknown }).$date;
    if (typeof inner === "string") {
      return inner;
    }
    if (typeof inner === "number") {
      return new Date(inner).toISOString();
    }
  }
  return null;
}

function parseFindFirstBatch(raw: unknown): MigrationChangelogRow[] {
  if (typeof raw !== "object" || raw === null) {
    return [];
  }
  const cursor = (raw as Record<string, unknown>).cursor;
  if (typeof cursor !== "object" || cursor === null) {
    return [];
  }
  const firstBatch = (cursor as Record<string, unknown>).firstBatch;
  if (!Array.isArray(firstBatch)) {
    return [];
  }

  const rows: MigrationChangelogRow[] = [];
  for (const doc of firstBatch) {
    if (typeof doc !== "object" || doc === null) {
      continue;
    }
    const d = doc as Record<string, unknown>;
    const fileName = d.fileName;
    if (typeof fileName !== "string") {
      continue;
    }
    rows.push({
      fileName,
      appliedAt: serializeAppliedAt(d.appliedAt),
    });
  }
  return rows;
}

export async function readMigrationChangelog(
  prisma: PrismaClient,
  collectionName: string,
): Promise<MigrationChangelogRow[]> {
  const raw = await prisma.$runCommandRaw({
    find: collectionName,
    filter: {},
    sort: { fileName: 1 },
    batchSize: 500,
  } as Prisma.InputJsonObject);
  return parseFindFirstBatch(raw);
}
