/**
 * Baseline migration — keeps the `mongo/migrations` tree non-empty.
 * Use `npm run mongo:migrate:create -- <name>` for new files.
 *
 * @param {import('mongodb').Db} db
 * @param {import('mongodb').MongoClient} _client
 */
export const up = async (db, _client) => {
  void db;
  // Add indexes, backfills, or collection tweaks that Prisma `db push` does not cover.
};

/**
 * @param {import('mongodb').Db} db
 * @param {import('mongodb').MongoClient} _client
 */
export const down = async (db, _client) => {
  void db;
};
