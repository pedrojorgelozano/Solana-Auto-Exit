import type { Db } from "../db/client.js";

/**
 * tRPC context. Use a type alias (no interface) so it satisfies
 * Record<string, unknown> required by the Hono tRPC adapter.
 */
export type AppContext = {
  db: Db;
};
