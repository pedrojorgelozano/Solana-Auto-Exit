import { z } from "zod";
import { eq } from "drizzle-orm";

import { router, publicProcedure } from "../init.js";
import { settings } from "../../db/schema.js";

/**
 * Snapshot que la UI usa para pre-llenar el form de configure y el listado
 * de posiciones. Cualquier key ausente cae a su default hardcodeado.
 *
 * NOTA F3: solo devnet. Mainnet está bloqueado por F4 + ADR-006 (requiere
 * ALLOW_MAINNET_LIVE y un audit visual antes de ofrecerlo en la UI).
 */
export interface SettingsSnapshot {
  /** "devnet" | "mainnet". F3 solo permite escribir "devnet". */
  network: "devnet" | "mainnet";
  /** URL del RPC. Por defecto el público de devnet; se puede sustituir por uno propio (Helius, QuickNode, etc). */
  rpcUrl: string;
  /** Slippage del cierre, en bps. */
  defaultSlippageBps: number;
  /** Slippage del swap de salida, en bps. */
  defaultExitSlippageBps: number;
  /** Intervalo de poll del watcher, en ms. */
  defaultPollMs: number;
}

const DEFAULTS: SettingsSnapshot = {
  network: "devnet",
  rpcUrl: "https://api.devnet.solana.com",
  defaultSlippageBps: 100,
  defaultExitSlippageBps: 100,
  defaultPollMs: 5_000,
};

/** Mapeo "key del snapshot" → "key persistida en SQLite". */
const KEYS = {
  network: "network",
  rpcUrl: "rpc_url",
  defaultSlippageBps: "default_slippage_bps",
  defaultExitSlippageBps: "default_exit_slippage_bps",
  defaultPollMs: "default_poll_ms",
} as const;

const updateInput = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("network"),
    // Solo devnet hasta F4 (ver nota en SettingsSnapshot).
    value: z.literal("devnet"),
  }),
  z.object({
    key: z.literal("rpcUrl"),
    value: z.string().url(),
  }),
  z.object({
    key: z.literal("defaultSlippageBps"),
    value: z.number().int().min(0).max(10_000),
  }),
  z.object({
    key: z.literal("defaultExitSlippageBps"),
    value: z.number().int().min(0).max(10_000),
  }),
  z.object({
    key: z.literal("defaultPollMs"),
    value: z.number().int().min(1_000).max(600_000),
  }),
]);

export const settingsRouter = router({
  /**
   * Devuelve el snapshot completo con defaults aplicados para las keys
   * que aún no están persistidas. La UI lee esto al cargar el form de
   * configure y la página de settings.
   */
  get: publicProcedure.query(({ ctx }): SettingsSnapshot => {
    const rows = ctx.db.select().from(settings).all();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      network:
        map.get(KEYS.network) === "mainnet" ? "mainnet" : DEFAULTS.network,
      rpcUrl: map.get(KEYS.rpcUrl) ?? DEFAULTS.rpcUrl,
      defaultSlippageBps: parseIntOr(
        map.get(KEYS.defaultSlippageBps),
        DEFAULTS.defaultSlippageBps,
      ),
      defaultExitSlippageBps: parseIntOr(
        map.get(KEYS.defaultExitSlippageBps),
        DEFAULTS.defaultExitSlippageBps,
      ),
      defaultPollMs: parseIntOr(
        map.get(KEYS.defaultPollMs),
        DEFAULTS.defaultPollMs,
      ),
    };
  }),

  /**
   * Upsert de una key. La UI llama esto on-blur o on-submit por cada cambio.
   */
  update: publicProcedure.input(updateInput).mutation(({ ctx, input }) => {
    const dbKey = KEYS[input.key];
    const dbValue = String(input.value);
    ctx.db
      .insert(settings)
      .values({ key: dbKey, value: dbValue })
      .onConflictDoUpdate({ target: settings.key, set: { value: dbValue } })
      .run();
    return { ok: true };
  }),

  /** Reset a defaults. Borra todas las keys de settings. */
  reset: publicProcedure.mutation(({ ctx }) => {
    for (const dbKey of Object.values(KEYS)) {
      ctx.db.delete(settings).where(eq(settings.key, dbKey)).run();
    }
    return { ok: true };
  }),
});

function parseIntOr(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}
