import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadBaseConfig } from "./env.js";

/**
 * Baseline válida. Cada test parte de aquí (aplicada en beforeEach) y solo
 * sobrescribe la variable que quiere probar. Las opcionales van vacías ("" =
 * ausente para `optional()`), así el entorno real de la máquina no contamina.
 */
const VALID: Record<string, string> = {
  PROTOCOL: "orca",
  NETWORK: "devnet",
  RPC_URL: "https://api.devnet.solana.com",
  TARGET_PRICE: "100",
  DIRECTION: "above",
  SLIPPAGE_BPS: "100",
  POLL_MS: "5000",
  WALLET_PATH: "/tmp/wallet.json",
  DRY_RUN: "true",
  EXIT_TOKEN_MINT: "",
  EXIT_SWAP_SLIPPAGE_BPS: "",
  ALLOW_MAINNET_LIVE: "",
};

function setEnv(overrides: Record<string, string> = {}): void {
  for (const [k, v] of Object.entries({ ...VALID, ...overrides })) {
    vi.stubEnv(k, v);
  }
}

describe("loadBaseConfig", () => {
  beforeEach(() => setEnv());
  afterEach(() => vi.unstubAllEnvs());

  it("parsea una config válida completa", () => {
    const cfg = loadBaseConfig();
    expect(cfg).toMatchObject({
      protocol: "orca",
      network: "devnet",
      rpcUrl: "https://api.devnet.solana.com",
      targetPrice: 100,
      direction: "above",
      slippageBps: 100,
      pollMs: 5000,
      walletPath: "/tmp/wallet.json",
      dryRun: true,
    });
    expect(cfg.exitTokenMint).toBeUndefined();
    // exitSwapSlippageBps cae a slippageBps cuando no se especifica.
    expect(cfg.exitSwapSlippageBps).toBe(100);
  });

  it("normaliza protocol y network a minúsculas", () => {
    setEnv({ PROTOCOL: "ORCA", NETWORK: "DevNet" });
    const cfg = loadBaseConfig();
    expect(cfg.protocol).toBe("orca");
    expect(cfg.network).toBe("devnet");
  });

  // --- required / formato ---------------------------------------------------

  it("lanza si falta PROTOCOL", () => {
    setEnv({ PROTOCOL: "" });
    expect(() => loadBaseConfig()).toThrow(/Falta variable de entorno requerida: PROTOCOL/);
  });

  it("lanza con NETWORK inválido", () => {
    setEnv({ NETWORK: "testnet" });
    expect(() => loadBaseConfig()).toThrow(/NETWORK debe ser/);
  });

  it("lanza con TARGET_PRICE no positivo o no numérico", () => {
    setEnv({ TARGET_PRICE: "0" });
    expect(() => loadBaseConfig()).toThrow(/TARGET_PRICE/);
    setEnv({ TARGET_PRICE: "abc" });
    expect(() => loadBaseConfig()).toThrow(/TARGET_PRICE/);
  });

  it("lanza con DIRECTION inválido", () => {
    setEnv({ DIRECTION: "sideways" });
    expect(() => loadBaseConfig()).toThrow(/DIRECTION debe ser/);
  });

  it("lanza con SLIPPAGE_BPS fuera de rango o no entero", () => {
    setEnv({ SLIPPAGE_BPS: "10001" });
    expect(() => loadBaseConfig()).toThrow(/SLIPPAGE_BPS/);
    setEnv({ SLIPPAGE_BPS: "50.5" });
    expect(() => loadBaseConfig()).toThrow(/SLIPPAGE_BPS/);
  });

  it("lanza con POLL_MS menor que 1000", () => {
    setEnv({ POLL_MS: "500" });
    expect(() => loadBaseConfig()).toThrow(/POLL_MS/);
  });

  // --- parseBool (DRY_RUN) --------------------------------------------------

  it.each(["false", "0", "no"])("DRY_RUN=%s → false", (v) => {
    setEnv({ DRY_RUN: v });
    expect(loadBaseConfig().dryRun).toBe(false);
  });

  it.each(["true", "1", "yes"])("DRY_RUN=%s → true", (v) => {
    setEnv({ DRY_RUN: v });
    expect(loadBaseConfig().dryRun).toBe(true);
  });

  it("DRY_RUN inválido lanza", () => {
    setEnv({ DRY_RUN: "maybe" });
    expect(() => loadBaseConfig()).toThrow(/DRY_RUN debe ser/);
  });

  it("DRY_RUN ausente cae a true (default)", () => {
    setEnv({ DRY_RUN: "" });
    expect(loadBaseConfig().dryRun).toBe(true);
  });

  // --- exit swap ------------------------------------------------------------

  it("EXIT_TOKEN_MINT presente se devuelve, ausente queda undefined", () => {
    setEnv({ EXIT_TOKEN_MINT: "So11111111111111111111111111111111111111112" });
    expect(loadBaseConfig().exitTokenMint).toBe(
      "So11111111111111111111111111111111111111112",
    );
  });

  it("EXIT_SWAP_SLIPPAGE_BPS válido se usa; inválido lanza", () => {
    setEnv({ EXIT_SWAP_SLIPPAGE_BPS: "250" });
    expect(loadBaseConfig().exitSwapSlippageBps).toBe(250);
    setEnv({ EXIT_SWAP_SLIPPAGE_BPS: "99999" });
    expect(() => loadBaseConfig()).toThrow(/EXIT_SWAP_SLIPPAGE_BPS/);
  });

  // --- gate de mainnet (ADR-026) --------------------------------------------

  it("mainnet + dryRun=false + ALLOW_MAINNET_LIVE=false → bloquea", () => {
    setEnv({ NETWORK: "mainnet", DRY_RUN: "false", ALLOW_MAINNET_LIVE: "false" });
    expect(() => loadBaseConfig()).toThrow(/Bloqueado/);
  });

  it("mainnet + dryRun=false + ALLOW_MAINNET_LIVE ausente → permitido (default true)", () => {
    setEnv({ NETWORK: "mainnet", DRY_RUN: "false" });
    expect(loadBaseConfig().network).toBe("mainnet");
  });

  it("mainnet + dryRun=true → no se consulta el gate", () => {
    setEnv({ NETWORK: "mainnet", DRY_RUN: "true", ALLOW_MAINNET_LIVE: "false" });
    expect(() => loadBaseConfig()).not.toThrow();
  });
});
