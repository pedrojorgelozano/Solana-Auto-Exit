import { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@solana-auto-exit/server/api";

/**
 * Convierte un error de mutation/query tRPC al mensaje más legible posible.
 *
 * El caso que motiva esto: cuando un input falla la validación zod del server,
 * tRPC serializa el ZodError como un array JSON en `err.message`. Por ejemplo
 * un rpcUrl sin scheme llega como
 *   `[{"code":"invalid_string","validation":"url","message":"Invalid url",...}]`
 * y el usuario veía ese blob crudo en el form. Aquí extraemos el primer
 * `message` legible del `err.data.zodError` (que tRPC popula con
 * `fieldErrors` y `formErrors` ya parseados) y devolvemos eso.
 *
 * Para errores no-zod (TRPCError thrown manualmente, errores de red, etc.)
 * caemos al `err.message` o a `String(err)` normales.
 */
type AppTRPCError = TRPCClientError<AppRouter>;

interface ZodErrorShape {
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[];
}

export function formatTrpcError(err: unknown): string {
  if (err instanceof TRPCClientError) {
    const data = (err as AppTRPCError).data as
      | { zodError?: ZodErrorShape | null }
      | null
      | undefined;
    const zodError = data?.zodError;
    if (zodError) {
      if (zodError.fieldErrors) {
        for (const messages of Object.values(zodError.fieldErrors)) {
          const first = messages?.[0];
          if (first) return first;
        }
      }
      const formFirst = zodError.formErrors?.[0];
      if (formFirst) return formFirst;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
