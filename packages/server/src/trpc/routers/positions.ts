import { z } from "zod";
import { router, publicProcedure, TRPCError } from "../init.js";
import { makeAdapter } from "@solana-auto-exit/engine";
import { assertSafeRpcUrl } from "../../security/rpc-url.js";

/**
 * Defensa SSRF: el `rpcUrl` llega directo del cliente y se usa para hacer
 * fetch desde el server. Misma validación que aplican `tasks.create` y
 * `settings.update`/`testRpc`; aquí cerramos el mismo hueco para los
 * endpoints read-only de descubrimiento (alcanzables sin vault unlocked).
 */
function assertSafeRpc(rpcUrl: string): void {
  try {
    assertSafeRpcUrl(rpcUrl);
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err instanceof Error ? err.message : "Invalid rpcUrl",
    });
  }
}

const baseInput = z.object({
  protocol: z.string().min(1),
  network: z.enum(["mainnet", "devnet"]),
  rpcUrl: z.string().url(),
});

const positionRefSchema = z.object({
  protocol: z.string().min(1),
  id: z.string().min(1),
  label: z.string(),
  poolId: z.string().min(1),
});

/**
 * Meteora descubre posiciones con getProgramAccounts (DLMM.getAllLbPair…),
 * que algunos proveedores RPC restringen, deshabilitan o rate-limitan. Cuando
 * el error apunta a eso, añadimos una pista accionable en vez de propagar un
 * críptico "410 Gone" / "-32010". (El caso "0 pools sin error" es distinto:
 * ahí el provider devuelve [] con 200 OK y no hay throw — eso lo cubre el
 * aviso de coherencia red↔RPC del dashboard, rpcNetworkMismatch.)
 */
const GPA_RESTRICTION_HINTS = [
  "getprogramaccounts",
  "long-term storage",
  "not available",
  "disabled",
  "-32010",
  "-32052",
  "410",
  "exceeded",
  "too large",
];

function decorateDiscoveryError(protocol: string, raw: string): string {
  if (protocol.toLowerCase() !== "meteora") return raw;
  const lower = raw.toLowerCase();
  if (!GPA_RESTRICTION_HINTS.some((h) => lower.includes(h))) return raw;
  return (
    `${raw}\n\nMeteora position discovery relies on the getProgramAccounts ` +
    `RPC method, which some providers restrict or rate-limit. If yours blocks ` +
    `it, switch to a provider that allows filtered getProgramAccounts (e.g. Helius).`
  );
}

export const positionsRouter = router({
  /**
   * Descubre las posiciones del protocolo en la wallet indicada.
   * Read-only: no necesita vault unlocked.
   */
  listOwned: publicProcedure
    .input(baseInput.extend({ owner: z.string().min(32) }))
    .query(async ({ input }) => {
      assertSafeRpc(input.rpcUrl);
      const adapter = makeAdapter(input.protocol);
      await adapter.setupRpc({
        network: input.network,
        rpcUrl: input.rpcUrl,
      });
      try {
        return await adapter.listOwnedPositions(input.owner);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: decorateDiscoveryError(
            input.protocol,
            err instanceof Error ? err.message : String(err),
          ),
        });
      }
    }),

  /**
   * Detalle de una posición: tokens, precio actual, rango, in/out of range,
   * liquidez estimada y fees pendientes. Read-only.
   */
  getSummary: publicProcedure
    .input(baseInput.extend({ ref: positionRefSchema }))
    .query(async ({ input }) => {
      assertSafeRpc(input.rpcUrl);
      const adapter = makeAdapter(input.protocol);
      await adapter.setupRpc({
        network: input.network,
        rpcUrl: input.rpcUrl,
      });
      try {
        return await adapter.getPositionSummary(input.ref);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  /** Schema declarativo del adapter para que la UI renderice el formulario. */
  configSchema: publicProcedure
    .input(z.object({ protocol: z.string().min(1) }))
    .query(({ input }) => {
      const adapter = makeAdapter(input.protocol);
      return adapter.getConfigSchema();
    }),
});
