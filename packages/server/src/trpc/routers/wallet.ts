import { generateKeyPairSync } from "node:crypto";
import { z } from "zod";
import { getBase58Codec } from "@solana/kit";
import { eq } from "drizzle-orm";

import { router, publicProcedure, TRPCError } from "../init.js";
import {
  bytesFromBase58,
  bytesFromJsonArray,
} from "../../wallet/import.js";
import { settings as settingsTable } from "../../db/schema.js";
import {
  assertUnlockAllowed,
  recordUnlockFailure,
  recordUnlockSuccess,
} from "../../security/unlock-limiter.js";

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

const sourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("base58"), value: z.string().min(40) }),
  z.object({ type: z.literal("jsonArray"), value: z.string().min(5) }),
]);

export const walletRouter = router({
  /** Estado del vault. Llamable siempre. */
  status: publicProcedure.query(({ ctx }) => ctx.vault.status()),

  /**
   * Genera una keypair Solana nueva, la cifra con la passphrase, persiste
   * el vault y devuelve el secret en base58 UNA SOLA VEZ para que el
   * usuario lo guarde en su gestor de contraseñas. Tras esto el vault
   * queda desbloqueado.
   *
   * Es el flujo "Generate new bot wallet" del onboarding.
   */
  generate: publicProcedure
    .input(z.object({ passphrase: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      // ed25519 vía node:crypto (zero deps). PKCS8 DER de la priv termina
      // con los 32 bytes del seed; SPKI DER de la pub termina con los 32
      // bytes del raw pub. El secret de Solana son los 64 bytes seed+pub.
      const { privateKey, publicKey } = generateKeyPairSync("ed25519");
      const privDer = privateKey.export({ format: "der", type: "pkcs8" });
      const seed = privDer.subarray(privDer.length - 32);
      const pubDer = publicKey.export({ format: "der", type: "spki" });
      const pubRaw = pubDer.subarray(pubDer.length - 32);
      const secretKey = new Uint8Array(Buffer.concat([seed, pubRaw]));

      const created = await ctx.vault.create(input.passphrase, secretKey);
      // Auto-unlock para que el usuario salga del modal listo para operar.
      await ctx.vault.unlock(input.passphrase);

      const secretBase58 = getBase58Codec().decode(secretKey);
      return {
        address: created.address,
        secretBase58,
      };
    }),

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
      try {
        return await ctx.vault.create(input.passphrase, bytes);
      } catch (err) {
        // `vault.create` lanza Errors claros (vault ya existe, passphrase
        // corta, clave inválida) — todos son error de input del usuario.
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  /**
   * Desbloquea el vault (descifra el secret y lo guarda en memoria).
   * Protegido por unlock-limiter: 5 intentos fallidos / 5 min activan un
   * cool-down con TOO_MANY_REQUESTS hasta que la ventana deslizante libera
   * un slot. Un unlock exitoso resetea el contador.
   */
  unlock: publicProcedure
    .input(z.object({ passphrase: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        assertUnlockAllowed();
      } catch (err) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      try {
        const result = await ctx.vault.unlock(input.passphrase);
        recordUnlockSuccess();
        return result;
      } catch (err) {
        // Cualquier fallo del unlock (passphrase incorrecta, vault corrupt,
        // tag mismatch del GCM, etc.) cuenta como intento. Le re-lanzamos
        // el error original para que el cliente vea la causa.
        recordUnlockFailure();
        throw err;
      }
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

  /**
   * Consulta el balance de SOL de una address vía el RPC configurado en
   * settings. Útil en el onboarding post-Generate para confirmar que han
   * llegado los fondos.
   */
  balance: publicProcedure
    .input(z.object({ address: z.string().min(32) }))
    .query(async ({ ctx, input }) => {
      const row = ctx.db
        .select()
        .from(settingsTable)
        .where(eq(settingsTable.key, "rpc_url"))
        .get();
      const rpcUrl = row?.value ?? DEFAULT_RPC_URL;
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [input.address],
        }),
        // Sin timeout un RPC colgado bloquea esta query y todas las que
        // dependen del mismo proceso event loop. 10s es bastante para un
        // simple getBalance.
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json()) as {
        result?: { value: number };
        error?: { message?: string };
      };
      if (body.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: body.error.message ?? "RPC error",
        });
      }
      return { lamports: body.result?.value ?? 0 };
    }),
});
