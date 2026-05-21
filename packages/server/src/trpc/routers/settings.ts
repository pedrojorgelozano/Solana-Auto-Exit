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
  /** URL del RPC actualmente seleccionada. */
  rpcUrl: string;
  /**
   * URLs canónicas por red — la UI las usa para (a) mostrar el placeholder
   * correcto al editar, (b) auto-swappear el rpcUrl al cambiar de red si el
   * actual coincide con el default de la red anterior, (c) ofrecer botón
   * "use default" cuando el user customizó y quiere volver al canónico.
   */
  defaultRpcByNetwork: {
    mainnet: string;
    devnet: string;
  };
  /** Slippage del cierre, en bps. */
  defaultSlippageBps: number;
  /** Slippage del swap de salida, en bps. */
  defaultExitSlippageBps: number;
  /** Intervalo de poll del watcher, en ms. */
  defaultPollMs: number;
  /**
   * Valores factory-default — lo que el snapshot devolvería tras un Reset.
   * La UI los usa para implementar Reset imperativamente, sin depender de
   * que TanStack Query detecte un cambio en el snapshot (que puede ser
   * deep-equal si el DB ya estaba en defaults). Estos campos son siempre
   * constantes (no leen del DB).
   */
  factoryDefaults: {
    network: "devnet" | "mainnet";
    rpcUrl: string;
    slippageBps: number;
    exitSlippageBps: number;
    pollMs: number;
  };
  /** Si el server tiene ALLOW_MAINNET_LIVE=true, la UI ofrece el switch a mainnet con confirmación. */
  mainnetGateAllowed: boolean;
}

/**
 * RPCs canónicas por red. Son los endpoints públicos oficiales de Solana —
 * funcionan out-of-the-box para arrancar pero están rate-limited (sobre todo
 * mainnet-beta). Para uso sostenido la UI sugiere reemplazar por Helius /
 * QuickNode / Triton / nodo propio en /settings.
 */
const DEFAULT_RPC = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
} as const;

const DEFAULTS = {
  // F6.3 / ADR-027: el default es mainnet. Operar en LP de verdad es el caso
  // de uso primario; testnet sigue disponible pero como opción no-default.
  network: "mainnet" as const,
  rpcUrl: DEFAULT_RPC.mainnet,
  defaultSlippageBps: 100,
  defaultExitSlippageBps: 100,
  // F6.3: subido de 5_000 (legacy, demasiado agresivo con RPC) a 30_000.
  // Con time-buffers la latencia del polling es cosmética; 30s es el sweet
  // spot que cabe en Helius free tier por watcher. Ver explicación en /settings.
  defaultPollMs: 30_000,
};

/**
 * Mainnet gate. Originalmente cerrado por defecto (ADR-006) y abierto vía
 * `ALLOW_MAINNET_LIVE=true`. Superado por ADR-026: el gate está abierto por
 * defecto, la safety net real es la confirmación de doble paso en la UI.
 * El field `mainnetGateAllowed` del snapshot se mantiene en la API por si en
 * el futuro queremos volver a meter una política de cierre (servidor multi-
 * usuario, deploy compartido, etc.) — hoy devuelve siempre true.
 */
function isMainnetGateAllowed(): boolean {
  return true;
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
    // ADR-027: respetamos el valor stored si es válido. El gate ya no fuerza
    // downgrade a devnet (ADR-026: gate siempre abierto). Si la key no está
    // (fresh install o tras reset), cae a DEFAULTS.network → mainnet.
    const storedNetwork = map.get(KEYS.network);
    const network: "mainnet" | "devnet" =
      storedNetwork === "mainnet" || storedNetwork === "devnet"
        ? storedNetwork
        : DEFAULTS.network;
    return {
      network,
      // rpcUrl ahora hace fallback a la URL canónica de la red activa,
      // no a DEFAULTS.rpcUrl (que es siempre mainnet). Importante porque
      // tras un Reset (que preserva network) el rpcUrl deja de estar
      // stored y debe poderse derivar coherentemente con la red.
      rpcUrl: map.get(KEYS.rpcUrl) ?? DEFAULT_RPC[network],
      defaultRpcByNetwork: {
        mainnet: DEFAULT_RPC.mainnet,
        devnet: DEFAULT_RPC.devnet,
      },
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
      // factoryDefaults representa "lo que devolvería el snapshot tras un
      // Reset". El Reset preserva la red, así que rpcUrl tiene que ser la
      // canónica de la red ACTUAL (no una fija). El resto son constantes.
      factoryDefaults: {
        network,
        rpcUrl: DEFAULT_RPC[network],
        slippageBps: DEFAULTS.defaultSlippageBps,
        exitSlippageBps: DEFAULTS.defaultExitSlippageBps,
        pollMs: DEFAULTS.defaultPollMs,
      },
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

  /**
   * Reset a defaults: borra rpcUrl, slippage, exit-slippage y pollMs.
   * **Preserva el row `network`** — cambiar de red es una decisión deliberada
   * con implicaciones de seguridad (firma con fondos reales vs test), así
   * que el Reset no debe alterarla silenciosamente. El usuario que quiera
   * cambiar de red tiene el toggle TEST/REAL para hacerlo explícitamente.
   */
  reset: publicProcedure.mutation(({ ctx }) => {
    for (const [snapshotKey, dbKey] of Object.entries(KEYS)) {
      if (snapshotKey === "network") continue;
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
