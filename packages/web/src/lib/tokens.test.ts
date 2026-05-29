import { describe, it, expect } from "vitest";
import { allKnownTokens, tokenSymbol, tokenMeta, isKnownToken } from "./tokens.js";

/**
 * Invariantes del token registry. Es una app de dinero real: un mint
 * duplicado o mal copiado mostraría el símbolo equivocado sobre una
 * posición con fondos. Estos checks son baratos y atrapan el copy-paste
 * accidental al añadir un token nuevo.
 */
describe("token registry invariants", () => {
  const tokens = allKnownTokens();

  it("has no duplicate mints", () => {
    const mints = tokens.map((t) => t.mint);
    expect(new Set(mints).size).toBe(mints.length);
  });

  it("has no duplicate symbols", () => {
    const symbols = tokens.map((t) => t.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("every mint is a plausible base58 pubkey (32-44 chars, no 0OIl)", () => {
    for (const t of tokens) {
      expect(t.mint.length, t.symbol).toBeGreaterThanOrEqual(32);
      expect(t.mint.length, t.symbol).toBeLessThanOrEqual(44);
      // base58 excluye 0 (cero), O, I, l mayúscula/minúscula ambiguas.
      expect(t.mint, t.symbol).not.toMatch(/[0OIl]/);
    }
  });

  it("every token has sane decimals (0-18) and non-empty name/symbol", () => {
    for (const t of tokens) {
      expect(Number.isInteger(t.decimals), t.symbol).toBe(true);
      expect(t.decimals, t.symbol).toBeGreaterThanOrEqual(0);
      expect(t.decimals, t.symbol).toBeLessThanOrEqual(18);
      expect(t.symbol.trim().length, t.mint).toBeGreaterThan(0);
      expect(t.name.trim().length, t.mint).toBeGreaterThan(0);
    }
  });
});

describe("tokenSymbol / lookups", () => {
  it("resolves a known mint to its symbol", () => {
    expect(tokenSymbol("So11111111111111111111111111111111111111112")).toBe(
      "SOL",
    );
  });

  it("truncates an unknown mint instead of throwing", () => {
    const unknown = "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9A";
    expect(tokenSymbol(unknown)).toBe(`${unknown.slice(0, 4)}…${unknown.slice(-4)}`);
  });

  it("returns '?' for an empty mint", () => {
    expect(tokenSymbol("")).toBe("?");
  });

  it("isKnownToken / tokenMeta agree", () => {
    const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    expect(isKnownToken(mint)).toBe(true);
    expect(tokenMeta(mint)?.symbol).toBe("USDC");
    expect(isKnownToken("nope")).toBe(false);
    expect(tokenMeta("nope")).toBeUndefined();
  });
});
