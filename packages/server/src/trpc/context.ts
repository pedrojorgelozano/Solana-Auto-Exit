import type { Db } from "../db/client.js";
import type { WalletVault } from "../wallet/vault.js";
import type { TaskManager } from "../tasks/manager.js";

/**
 * tRPC context. Type alias (not interface) so it satisfies the
 * Record<string, unknown> required by the Hono tRPC adapter.
 */
export type AppContext = {
  db: Db;
  vault: WalletVault;
  taskManager: TaskManager;
};
