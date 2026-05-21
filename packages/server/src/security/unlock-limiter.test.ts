import { describe, it, expect, beforeEach } from "vitest";
import {
  assertUnlockAllowed,
  recordUnlockFailure,
  recordUnlockSuccess,
  getUnlockLimitState,
} from "./unlock-limiter.js";

// El módulo guarda estado in-memory entre tests. Usamos `recordUnlockSuccess`
// (que limpia el array) para resetear antes de cada caso. Es la API pública
// más estable; evitamos tocar `state` directamente.
function resetState(): void {
  recordUnlockSuccess();
}

const T0 = 1_700_000_000_000; // Mon Nov 14 2023, base reproducible.

describe("unlock-limiter sliding window", () => {
  beforeEach(resetState);

  it("permits the first 5 attempts within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(() => assertUnlockAllowed(T0 + i * 1000)).not.toThrow();
      recordUnlockFailure(T0 + i * 1000);
    }
  });

  it("blocks the 6th attempt within the window with a wait message", () => {
    for (let i = 0; i < 5; i++) {
      recordUnlockFailure(T0 + i * 1000);
    }
    expect(() => assertUnlockAllowed(T0 + 5_000)).toThrow(/Try again/);
  });

  it("releases the lock when the window slides past the oldest failure", () => {
    // 5 fallos en T0..T0+4s.
    for (let i = 0; i < 5; i++) recordUnlockFailure(T0 + i * 1000);

    // En T0 + (5 min - 1ms) sigue bloqueado.
    expect(() => assertUnlockAllowed(T0 + 5 * 60 * 1000 - 1)).toThrow(/Try again/);

    // En T0 + 5 min + 1ms el primer fallo cae fuera de la ventana → libre.
    expect(() => assertUnlockAllowed(T0 + 5 * 60 * 1000 + 1)).not.toThrow();
  });

  it("includes seconds-to-wait in the error message", () => {
    for (let i = 0; i < 5; i++) recordUnlockFailure(T0 + i * 1000);
    try {
      assertUnlockAllowed(T0 + 60_000); // 1 min después del primer fallo
      throw new Error("should have thrown");
    } catch (err) {
      // 5min - 1min = 4min restantes ~= 240s.
      expect((err as Error).message).toMatch(/240s/);
    }
  });

  it("resets the counter on successful unlock", () => {
    for (let i = 0; i < 5; i++) recordUnlockFailure(T0 + i * 1000);
    expect(() => assertUnlockAllowed(T0 + 5_000)).toThrow();

    recordUnlockSuccess();
    expect(() => assertUnlockAllowed(T0 + 5_000)).not.toThrow();
  });

  it("getUnlockLimitState reports counts and lockedUntil", () => {
    expect(getUnlockLimitState(T0).attempts).toBe(0);
    expect(getUnlockLimitState(T0).lockedUntil).toBeNull();

    for (let i = 0; i < 5; i++) recordUnlockFailure(T0 + i * 1000);

    const state = getUnlockLimitState(T0 + 5_000);
    expect(state.attempts).toBe(5);
    expect(state.maxAttempts).toBe(5);
    expect(state.windowMs).toBe(5 * 60 * 1000);
    expect(state.lockedUntil).toBe(T0 + 5 * 60 * 1000); // oldest + window
  });

  it("partial reset: stale failures get pruned but recent ones stay", () => {
    recordUnlockFailure(T0);           // este va a expirar
    recordUnlockFailure(T0 + 4 * 60_000); // este vive hasta T0+9min
    // En T0 + 5min + 1ms: el primer fallo ya no cuenta, solo queda 1.
    expect(getUnlockLimitState(T0 + 5 * 60_000 + 1).attempts).toBe(1);
  });
});
