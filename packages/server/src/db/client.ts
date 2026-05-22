import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH ?? "./data/auto-exit.db";
const MIGRATIONS_FOLDER =
  process.env.DRIZZLE_MIGRATIONS ??
  path.resolve(__dirname, "..", "..", "drizzle");

// Asegura el directorio del DB
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

/**
 * Tipo público del handle drizzle. Los dos drivers (better-sqlite3 y
 * bun:sqlite) exponen la misma API de query; tipamos con el de
 * better-sqlite3 porque es el runtime de dev/test y tanto el resto del
 * código como los tests ya asumen esa forma.
 */
export type Db = BetterSQLite3Database<typeof schema>;

function migrationsReady(): boolean {
  if (fs.existsSync(MIGRATIONS_FOLDER)) return true;
  // Primera ejecución sin migraciones generadas: el server arranca pero las
  // queries fallarán hasta que se corra drizzle-kit generate.
  console.warn(
    `[db] No migrations folder at ${MIGRATIONS_FOLDER}. ` +
      `Run \`pnpm --filter @solana-auto-exit/server exec drizzle-kit generate\` first.`,
  );
  return false;
}

let db: Db;
let runMigrations: () => void;
let closeDb: () => void;

/**
 * Selección de driver SQLite por runtime:
 *  - Node (dev `tsx`, Docker, Vitest) → `better-sqlite3` (módulo nativo).
 *  - Bun (sidecar `bun --compile`)     → `bun:sqlite` (parte del runtime).
 *
 * `better-sqlite3` localiza su `.node` vía el paquete `bindings`, que recorre
 * el filesystem buscando un `node_modules` — layout inexistente dentro de un
 * binario `bun --compile`. `bun:sqlite` va embebido en el runtime de Bun, así
 * que el sidecar compilado no arrastra módulos nativos. Ver ADR-031.
 *
 * Los specifiers de la rama Bun llevan `as string` para que TypeScript no
 * resuelva `bun:sqlite` (el repo no tiene `@types/bun`); la type-assertion se
 * borra al emitir, así que el bundler de Bun ve el literal y lo resuelve.
 */
if (typeof process.versions.bun === "string") {
  const { Database } = await import("bun:sqlite" as string);
  const { drizzle } = await import("drizzle-orm/bun-sqlite" as string);
  const { migrate } = await import("drizzle-orm/bun-sqlite/migrator" as string);

  const sqlite = new Database(DB_PATH);
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");

  db = drizzle(sqlite, { schema }) as Db;
  runMigrations = () => {
    if (migrationsReady()) {
      migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    }
  };
  closeDb = () => sqlite.close();
} else {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  db = drizzle(sqlite, { schema });
  runMigrations = () => {
    if (migrationsReady()) {
      migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    }
  };
  closeDb = () => sqlite.close();
}

export { db, runMigrations, closeDb };
