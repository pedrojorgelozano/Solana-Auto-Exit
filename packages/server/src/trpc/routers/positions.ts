import { z } from "zod";
import { router, publicProcedure, TRPCError } from "../init.js";
import { makeAdapter } from "@solana-auto-exit/engine";

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

export const positionsRouter = router({
  /**
   * Descubre las posiciones del protocolo en la wallet indicada.
   * Read-only: no necesita vault unlocked.
   */
  listOwned: publicProcedure
    .input(baseInput.extend({ owner: z.string().min(32) }))
    .query(async ({ input }) => {
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
          message: err instanceof Error ? err.message : String(err),
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
