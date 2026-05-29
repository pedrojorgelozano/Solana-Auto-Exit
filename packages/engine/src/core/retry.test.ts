import { describe, it, expect, vi } from "vitest";

// Silenciamos el logger para no ensuciar la salida del runner (withRetry
// loguea cada intento fallido). De paso podemos aseverar las llamadas.
vi.mock("./logger.js", () => ({ log: vi.fn(), logError: vi.fn() }));

import { withRetry, isPermanentSolanaError } from "./retry.js";

describe("isPermanentSolanaError — heurística por keyword", () => {
  it.each([
    "SlippageExceeded",
    "0x1: insufficient funds for rent",
    "Invalid mint provided",
    "invalid pool address",
    "Invalid position account",
    "Account not found at address X",
    "AccountNotFound",
  ])("clasifica como permanente: %s", (msg) => {
    expect(isPermanentSolanaError(new Error(msg))).toBe(true);
  });

  it.each([
    "blockhash expired",
    "ETIMEDOUT connecting to RPC",
    "429 rate limit exceeded",
    "transaction was not confirmed in time",
    "boom",
  ])("clasifica como transitorio: %s", (msg) => {
    expect(isPermanentSolanaError(new Error(msg))).toBe(false);
  });

  it("es case-insensitive", () => {
    expect(isPermanentSolanaError(new Error("SLIPPAGE TOO HIGH"))).toBe(true);
  });

  it("acepta valores no-Error vía String(err)", () => {
    expect(isPermanentSolanaError("slippage")).toBe(true);
    expect(isPermanentSolanaError({})).toBe(false); // "[object Object]"
    expect(isPermanentSolanaError(null)).toBe(false);
  });
});

describe("withRetry — comportamiento", () => {
  it("devuelve el valor al primer intento exitoso (sin reintentos)", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, { maxAttempts: 5, baseMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reintenta hasta que tiene éxito", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient 1"))
      .mockRejectedValueOnce(new Error("transient 2"))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { maxAttempts: 5, baseMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("agota maxAttempts y lanza el último error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("err 1"))
      .mockRejectedValueOnce(new Error("err 2"))
      .mockRejectedValue(new Error("err 3 final"));
    await expect(withRetry(fn, { maxAttempts: 3, baseMs: 0 })).rejects.toThrow(
      "err 3 final",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("relanza inmediato si retryableErrors devuelve false (sin reintentos)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("SlippageExceeded"));
    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        baseMs: 0,
        retryableErrors: (err) => !isPermanentSolanaError(err),
      }),
    ).rejects.toThrow("SlippageExceeded");
    expect(fn).toHaveBeenCalledTimes(1); // permanente → un solo intento
  });

  it("reintenta cuando retryableErrors devuelve true", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("blockhash expired"))
      .mockResolvedValue("ok");
    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        baseMs: 0,
        retryableErrors: (err) => !isPermanentSolanaError(err),
      }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("withRetry — backoff exponencial", () => {
  // No usamos fake timers: el `sleep` de withRetry es un binding estático de
  // `node:timers/promises`, que @sinonjs/fake-timers no puede interceptar
  // (los named exports ESM son read-only). Medimos el wall-clock real con una
  // cota INFERIOR holgada — los sleeps nunca terminan antes de tiempo, así
  // que es estable, y distingue el backoff exponencial del lineal.
  it("aplica esperas crecientes baseMs · 2^(n-1) entre intentos", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("transient"));
    const start = performance.now();
    await withRetry(fn, { maxAttempts: 3, baseMs: 20 }).catch(() => {});
    const elapsed = performance.now() - start;

    expect(fn).toHaveBeenCalledTimes(3);
    // Esperas: 20 (2^0) + 40 (2^1) = 60ms. Lineal sería 20 + 20 = 40ms.
    // Cota inferior en 55ms confirma el crecimiento exponencial sin flakiness.
    expect(elapsed).toBeGreaterThanOrEqual(55);
  });
});
