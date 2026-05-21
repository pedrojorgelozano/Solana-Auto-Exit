import { z } from "zod";
import { eq } from "drizzle-orm";

import { router, publicProcedure, TRPCError } from "../init.js";
import { settings } from "../../db/schema.js";

/**
 * Snapshot que la UI usa para pre-llenar el form de configure y el listado
 * de posiciones. Cualquier key ausente cae a su default hardcodeado.
 *
 * F4.3: mainnet ahora es seleccionable si ALLOW_MAINNET_LIVE=true está
 * presente en el server. El snapshot expone `mainnetGateAllowed` para que
 * la UI sepa si renderizar el switch. Ver ADR-006 + ADR-023.
 */
export interface SettingsSnapshot {
  /** Red activa. La UI permite cambiar a "mainnet" solo si mainnetGateAllowed. */
  network: "devnet" | "mainnet";
  /** URL del RPC. Por defecto el público de devnet; se puede sustituir por uno propio (Helius, QuickNode, etc). */
  rpcUrl: string;
  /** Slippage del cierre, en bps. */
  defaultSlippageBps: number;
  /** Slippage del swap de salida, en bps. */
  defaultExitSlippageBps: number;
  /** Intervalo de poll del watcher, en ms. */
  defaultPollMs: number;
  /** Si el server tiene ALLOW_MAINNET_LIVE=true, la UI ofrece el switch a mainnet con confirmación. */
  mainnetGateAllowed: boolean;
}

const DEFAULTS = {
  network: "devnet" as const,
  rpcUrl: "https://api.devnet.solana.com",
  defaultSlippageBps: 100,
  defaultExitSlippageBps: 100,
  defaultPollMs: 5_000,
};

/** El env-var gate de ADR-006. Lo lee el server en cada query. */
function isMainnetGateAllowed(): boolean {
  return process.env.ALLOW_MAINNET_LIVE === "true";
}

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
    value: z.enum(["devnet", "mainnet"]),
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
    const gate = isMainnetGateAllowed();
    // Si mainnet fue activado en el pasado pero el env-var ya no está,
    // forzamos el snapshot a devnet — el gate del server gana sobre la fila.
    const storedNetwork = map.get(KEYS.network);
    const network =
      storedNetwork === "mainnet" && gate ? "mainnet" : DEFAULTS.network;
    return {
      network,
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
      mainnetGateAllowed: gate,
    };
  }),

  /**
   * Upsert de una key. La UI llama esto on-blur o on-submit por cada cambio.
   * Si la key es `network` y value es `mainnet`, el env-var gate de
   * ADR-006 (`ALLOW_MAINNET_LIVE=true`) tiene que estar activo en el server,
   * o la mutation falla. La UI lo evita renderizando el switch solo si
   * `mainnetGateAllowed`, pero el server enforza por seguridad.
   */
  update: publicProcedure.input(updateInput).mutation(({ ctx, input }) => {
    if (input.key === "network" && input.value === "mainnet" && !isMainnetGateAllowed()) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Mainnet is not enabled on this server. Set ALLOW_MAINNET_LIVE=true and restart.",
      });
    }
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
