import { z } from "zod";
import { eq } from "drizzle-orm";

import { router, publicProcedure, TRPCError } from "../init.js";
import { settings } from "../../db/schema.js";
import { assertSafeRpcUrl } from "../../security/rpc-url.js";

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
   * Umbral en lamports por debajo del cual el dashboard muestra el callout
   * "low balance". Default 50_000_000 (0.05 SOL) — margen razonable para
   * ~10 cierres + ATA creation. Un user que solo opera stables y nunca
   * abre cuentas nuevas puede bajarlo; uno con muchos cierres simultáneos
   * puede subirlo.
   */
  lowBalanceThresholdLamports: number;
  /**
   * Si la app desktop comprueba actualizaciones al arrancar. Off por
   * defecto: el check hace un fetch a GitHub, así que es opt-in (auditoría
   * de egress de red). Ver ADR-032.
   */
  updaterAutoCheck: boolean;
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
    lowBalanceThresholdLamports: number;
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
  // 0.05 SOL. Razonado para ~10 cierres + ATA creation. El frontend del
  // dashboard muestra "low balance" si el saldo cae por debajo.
  lowBalanceThresholdLamports: 50_000_000,
  // Auditoría de egress: el check de updates pinga GitHub, así que es opt-in.
  updaterAutoCheck: false,
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
  lowBalanceThresholdLamports: "low_balance_threshold_lamports",
  updaterAutoCheck: "updater_auto_check",
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
  z.object({
    key: z.literal("lowBalanceThresholdLamports"),
    // 0 desactiva el callout (caso "no me molestes nunca"). Tope 5 SOL —
    // un threshold mayor no aporta señal (5 SOL son ~200 cierres de margen).
    value: z.number().int().min(0).max(5_000_000_000),
  }),
  z.object({
    key: z.literal("updaterAutoCheck"),
    value: z.boolean(),
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
      lowBalanceThresholdLamports: parseIntOr(
        map.get(KEYS.lowBalanceThresholdLamports),
        DEFAULTS.lowBalanceThresholdLamports,
      ),
      // Boolean persistido como texto; cualquier cosa que no sea "true" → off.
      updaterAutoCheck: map.get(KEYS.updaterAutoCheck) === "true",
      // factoryDefaults representa "lo que devolvería el snapshot tras un
      // Reset". El Reset preserva la red, así que rpcUrl tiene que ser la
      // canónica de la red ACTUAL (no una fija). El resto son constantes.
      factoryDefaults: {
        network,
        rpcUrl: DEFAULT_RPC[network],
        slippageBps: DEFAULTS.defaultSlippageBps,
        exitSlippageBps: DEFAULTS.defaultExitSlippageBps,
        pollMs: DEFAULTS.defaultPollMs,
        lowBalanceThresholdLamports: DEFAULTS.lowBalanceThresholdLamports,
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
    // SSRF defense-in-depth: rechaza loopback / cloud-metadata / schemes raros
    // antes de persistir el rpcUrl. Modelo de amenaza y rationale: ver
    // packages/server/src/security/rpc-url.ts.
    if (input.key === "rpcUrl") {
      try {
        assertSafeRpcUrl(input.value);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const dbKey = KEYS[input.key];
    const dbValue = String(input.value);
    ctx.db
      .insert(settings)
      .values({ key: dbKey, value: dbValue })
      .onConflictDoUpdate({ target: settings.key, set: { value: dbValue } })
      .run();

    // Cuando cambias `network`, sincroniza el rpcUrl persistido si
    // estaba en el default canónico de la red anterior. Si era custom
    // (Helius con API key, Triton, etc.) respetamos lo que el usuario
    // configuró — solo auto-flippeamos cuando estaba en uno de los
    // dos defaults conocidos. Esto evita el caso real: usuario empieza
    // en devnet, persiste rpcUrl=devnet por defecto, switch a mainnet,
    // y luego `wallet.balance` consulta devnet con su address de
    // mainnet → 0 SOL aunque tenga SOL real.
    if (input.key === "network") {
      const targetNetwork = input.value as "mainnet" | "devnet";
      const currentRpcRow = ctx.db
        .select()
        .from(settings)
        .where(eq(settings.key, KEYS.rpcUrl))
        .get();
      const currentRpc = currentRpcRow?.value;
      const isCanonical =
        currentRpc === DEFAULT_RPC.mainnet ||
        currentRpc === DEFAULT_RPC.devnet;
      if (!currentRpc || isCanonical) {
        const nextRpc = DEFAULT_RPC[targetNetwork];
        ctx.db
          .insert(settings)
          .values({ key: KEYS.rpcUrl, value: nextRpc })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: nextRpc },
          })
          .run();
      }
    }

    return { ok: true };
  }),

  /**
   * Probe del RPC. La UI lo usa para confirmar que la URL configurada (o la
   * que el usuario está tipeando) responde antes de guardar. zod ya valida
   * que sea URL; esto valida reachability. Devuelve `{ ok, version, latencyMs }`
   * si el RPC responde a `getVersion` en <5s. Lanza con mensaje accionable si
   * falla (DNS, timeout, status no-OK, JSON corrupto, scheme/host bloqueado).
   *
   * Misma defensa SSRF que `update` — antes de hacer fetch, pasa por
   * assertSafeRpcUrl. Esto evita que el botón se use como side-channel para
   * probar reachability de IPs internas / metadata endpoints.
   */
  testRpc: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      try {
        assertSafeRpcUrl(input.url);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      const startedAt = Date.now();
      let res: Response;
      try {
        res = await fetch(input.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getVersion",
          }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch (err) {
        // AbortError → timeout. ConnectTimeoutError → undici DNS/TCP fail.
        // TypeError → fetch failure (CORS/scheme/network). Damos un mensaje
        // accionable; el `cause` original se pierde pero el message está
        // bien para el usuario.
        const detail = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Could not reach the RPC: ${detail}`,
        });
      }
      const latencyMs = Date.now() - startedAt;
      if (!res.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `RPC responded with HTTP ${res.status} ${res.statusText}.`,
        });
      }
      let body: { result?: { "solana-core"?: string }; error?: { message?: string } };
      try {
        body = (await res.json()) as typeof body;
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "RPC returned non-JSON. The URL may not be a Solana JSON-RPC endpoint.",
        });
      }
      if (body.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: body.error.message ?? "RPC returned an error.",
        });
      }
      const version = body.result?.["solana-core"];
      if (typeof version !== "string") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "RPC responded without a Solana version. The URL may not be a Solana JSON-RPC endpoint.",
        });
      }
      return { ok: true as const, version, latencyMs };
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

/**
 * Parsea un entero persistido en DB con clamp opcional. Antes era
 * `Number.isFinite ? n : fallback`, lo que dejaba pasar negativos
 * (`defaultSlippageBps = -100` se persistía sin protesta y causaba
 * comportamiento silencioso). Ahora rechaza los valores fuera de rango
 * y devuelve el fallback — el caller no necesita validar otra vez.
 * Las keys aplicables del settings router son todas no-negativas, y
 * el `updateInput` zod ya impone los upper bounds en escritura; este
 * clamp es defensa en lectura para datos que pudieron escribirse antes
 * del refuerzo o por una migración manual.
 */
function parseIntOr(
  raw: string | undefined,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  if (n < min || n > max) return fallback;
  return n;
}
