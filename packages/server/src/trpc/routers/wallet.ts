import { z } from "zod";
import { router, publicProcedure, TRPCError } from "../init.js";
import {
  bytesFromBase58,
  bytesFromJsonArray,
} from "../../wallet/import.js";

const sourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("base58"), value: z.string().min(40) }),
  z.object({ type: z.literal("jsonArray"), value: z.string().min(5) }),
]);

export const walletRouter = router({
  /** Estado del vault. Llamable siempre. */
  status: publicProcedure.query(({ ctx }) => ctx.vault.status()),

  /**
   * Crea un vault nuevo a partir de una clave privada (base58 estilo
   * Phantom/Backpack o array JSON estilo Solana CLI) + passphrase.
   * Falla si ya existe un vault.
   */
  create: publicProcedure
    .input(
      z.object({
        passphrase: z.string().min(8, "Passphrase must be at least 8 chars."),
        source: sourceSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let bytes: Uint8Array;
      try {
        bytes =
          input.source.type === "base58"
            ? bytesFromBase58(input.source.value)
            : bytesFromJsonArray(input.source.value);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return ctx.vault.create(input.passphrase, bytes);
    }),

  /** Desbloquea el vault (descifra el secret y lo guarda en memoria). */
  unlock: publicProcedure
    .input(z.object({ passphrase: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.vault.unlock(input.passphrase);
    }),

  /**
   * Lock manual del vault. Si hay tasks corriendo, todas se pausan
   * (el user las resume después de un nuevo unlock).
   */
  lock: publicProcedure.mutation(({ ctx }) => {
    ctx.taskManager.pauseAllOnVaultLock();
    ctx.vault.lock();
    return { ok: true };
  }),

  /** Borra el vault del disco. Irreversible — el wallet vuelve a estar fuera. */
  delete: publicProcedure.mutation(({ ctx }) => {
    ctx.taskManager.pauseAllOnVaultLock();
    ctx.vault.delete();
    return { ok: true };
  }),
});
