import type { Db } from "mongodb";

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

export async function readMigrationChangelog(
  db: Db,
  collectionName: string,
): Promise<MigrationChangelogRow[]> {
  const docs = await db
    .collection(collectionName)
    .find({})
    .sort({ fileName: 1 })
    .limit(500)
    .toArray();

  const rows: MigrationChangelogRow[] = [];
  for (const doc of docs) {
    const fileName = doc.fileName;
    if (typeof fileName !== "string") {
      continue;
    }
    rows.push({
      fileName,
      appliedAt: serializeAppliedAt(doc.appliedAt),
    });
  }
  return rows;
}
