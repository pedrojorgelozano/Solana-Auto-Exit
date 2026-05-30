import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { positionsRouter } from "./positions.js";
import type { AppContext } from "../context.js";

/**
 * Defensa SSRF en los endpoints de descubrimiento (read-only, alcanzables sin
 * vault unlocked). `assertSafeRpc` corre como PRIMERA línea de cada query, antes
 * de `makeAdapter`/`setupRpc`, así que una rpcUrl peligrosa se rechaza con
 * BAD_REQUEST sin llegar a abrir conexión de red. La cobertura exhaustiva de
 * qué hosts se bloquean vive en security/rpc-url.test.ts; aquí solo verificamos
 * que positions enchufa el guard (era el hueco que tenían tasks/settings tapado
 * y positions no).
 */

// listOwned/getSummary no tocan ctx; un contexto vacío basta para el caller.
const caller = positionsRouter.createCaller({} as AppContext);

const OWNER = "11111111111111111111111111111111"; // 32 chars, pasa z.string().min(32)
const REF = { protocol: "orca", id: "pos1", label: "", poolId: "pool1" };

// http(s) que pasan z.string().url() pero el guard SSRF debe bloquear.
const UNSAFE_URLS: ReadonlyArray<[string, string]> = [
  ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
  ["loopback", "http://127.0.0.1:8899/"],
  ["all-interfaces", "http://0.0.0.0:8899/"],
];

async function expectBadRequest(p: Promise<unknown>): Promise<void> {
  await expect(p).rejects.toBeInstanceOf(TRPCError);
  await expect(p).rejects.toMatchObject({ code: "BAD_REQUEST" });
}

describe("positionsRouter SSRF guard", () => {
  beforeEach(() => {
    delete process.env.ALLOW_LOOPBACK_RPC;
  });
  afterEach(() => {
    delete process.env.ALLOW_LOOPBACK_RPC;
  });

  for (const [name, rpcUrl] of UNSAFE_URLS) {
    it(`listOwned rejects ${name} with BAD_REQUEST`, async () => {
      await expectBadRequest(
        caller.listOwned({
          protocol: "orca",
          network: "mainnet",
          rpcUrl,
          owner: OWNER,
        }),
      );
    });

    it(`getSummary rejects ${name} with BAD_REQUEST`, async () => {
      await expectBadRequest(
        caller.getSummary({
          protocol: "orca",
          network: "mainnet",
          rpcUrl,
          ref: REF,
        }),
      );
    });
  }
});
