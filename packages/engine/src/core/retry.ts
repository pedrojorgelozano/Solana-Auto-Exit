import { setTimeout as sleep } from "node:timers/promises";
import { logError } from "./logger.js";

export interface RetryOptions {
  maxAttempts: number;
  baseMs: number;
  label?: string;
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
