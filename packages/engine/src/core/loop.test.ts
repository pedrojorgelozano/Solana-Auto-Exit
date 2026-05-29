import { describe, it, expect, vi } from "vitest";

vi.mock("./logger.js", () => ({ log: vi.fn(), logError: vi.fn() }));

import { loop } from "./loop.js";
import { logError } from "./logger.js";

describe("loop", () => {
  it("se detiene cuando el tick devuelve 'stop' (sin esperar)", async () => {
    const tick = vi.fn().mockResolvedValue("stop" as const);
    await loop({ pollMs: 999_999, tick });
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("vuelve a tickear mientras devuelva 'continue'", async () => {
    const tick = vi
      .fn()
      .mockResolvedValueOnce("continue" as const)
      .mockResolvedValueOnce("continue" as const)
      .mockResolvedValue("stop" as const);
    // pollMs pequeño con timers reales: el test acaba en pocos ms.
    await loop({ pollMs: 1, tick });
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("traga el error de un tick y continúa el siguiente ciclo", async () => {
    const tick = vi
      .fn()
      .mockRejectedValueOnce(new Error("tick boom"))
      .mockResolvedValue("stop" as const);
    await loop({ pollMs: 1, tick });
    expect(tick).toHaveBeenCalledTimes(2); // no propagó el throw
    expect(logError).toHaveBeenCalledOnce();
  });
});
