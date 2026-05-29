import { setTimeout as sleep } from "node:timers/promises";
import { logError } from "./logger.js";

export interface RetryOptions {
  maxAttempts: number;
  baseMs: number;
  label?: string;
  /**
   * Decide si un error es reintentable. Sin esto, `withRetry` reintentaba
   * CUALQUIER error 5 veces — incluyendo permanentes (SlippageExceeded,
   * InsufficientFunds, validation errors del adapter). Reintentar un
   * permanente solo añade latencia y demora el error real al usuario.
   * Cuando el predicado devuelve false, el error se relanza inmediatamente.
   * Si se omite, el comportamiento es el viejo: reintentar todo.
   */
  retryableErrors?: (err: unknown) => boolean;
}

/**
 * Heurística para distinguir errores Solana permanentes de los transitorios.
 *
 * Los SDKs (Orca, Meteora, web3.js) no exponen clases de error tipadas para
 * los program errors comunes — vienen como `Error` con strings tipo
 * `"SlippageExceeded"`, `"InsufficientFunds"`, o `"0x1: InsufficientFundsForRent"`.
 * Reintentar 5 veces un error de slippage no aporta nada: el precio se movió,
 * la próxima quote dará el mismo resultado, y la única salida es que el
 * usuario vea el error y decida (subir slippage, esperar, parar la task).
 *
 * Reintentables (devolvemos true): timeouts de red, blockhash expired,
 * congestion, rate-limit, "transaction not confirmed".
 *
 * No-reintentables (devolvemos false): slippage, fondos insuficientes,
 * cuentas inválidas, position no encontrada.
 *
 * Heurística por keywords del mensaje. Algún falso positivo es posible —
 * si pasa, prefieres reintentar de más que de menos.
 */
export function isPermanentSolanaError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("slippage") ||
    msg.includes("insufficient") ||
    msg.includes("invalid mint") ||
    msg.includes("invalid pool") ||
    msg.includes("invalid position") ||
    msg.includes("account not found") ||
    msg.includes("accountnotfound")
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const label = opts.label ?? "operación";
  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (opts.retryableErrors && !opts.retryableErrors(err)) {
        // Permanente — relanzar sin retry. El log es el "primer fallo" del
        // intento; con maxAttempts > 1 sería engañoso decir "intento 1/5".
        logError(`${label}: error permanente, sin retry`, err);
        throw err;
      }
      if (attempt === opts.maxAttempts) break;
      const delayMs = opts.baseMs * 2 ** (attempt - 1);
      logError(
        `${label}: intento ${attempt}/${opts.maxAttempts} falló, reintento en ${delayMs}ms`,
        err,
      );
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
