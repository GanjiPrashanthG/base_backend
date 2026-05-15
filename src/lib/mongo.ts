import { MongoClient, type Db } from "mongodb";
import { DEFAULT_SERVER_SELECTION_TIMEOUT_MS } from "../constants.js";

export type AppMongo = {
  db: Db;
  client: MongoClient;
  ping: () => Promise<void>;
  close: () => Promise<void>;
};

export async function connectMongo(databaseUrl: string, maxPoolSize: number): Promise<AppMongo> {
  const client = new MongoClient(databaseUrl, {
    maxPoolSize,
    serverSelectionTimeoutMS: DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
  });
  await client.connect();
  const db = client.db();
  return {
    db,
    client,
    ping: async () => {
      await db.command({ ping: 1 });
    },
    close: async () => client.close(),
  };
}
