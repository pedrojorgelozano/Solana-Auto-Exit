import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH ?? "./data/auto-exit.db";
const MIGRATIONS_FOLDER =
  process.env.DRIZZLE_MIGRATIONS ??
  path.resolve(__dirname, "..", "..", "drizzle");

// Asegura el directorio del DB
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;

export function runMigrations(): void {
  // Si la carpeta no existe (primera ejecución sin migraciones generadas),
  // dejamos pasar — el server arranca pero las queries fallarán hasta que
  // se generen migraciones con drizzle-kit.
  if (!fs.existsSync(MIGRATIONS_FOLDER)) {
    console.warn(
      `[db] No migrations folder at ${MIGRATIONS_FOLDER}. ` +
        `Run \`pnpm --filter @solana-auto-exit/server exec drizzle-kit generate\` first.`,
    );
    return;
  }
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

export function closeDb(): void {
  sqlite.close();
}
