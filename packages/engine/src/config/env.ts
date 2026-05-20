import "dotenv/config";
import type { BaseConfig, Direction } from "../protocols/types.js";

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") {
    throw new Error(`Falta variable de entorno requerida: ${name}`);
  }
  return v.trim();
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v.trim() === "" ? fallback : v.trim();
}

function parseBool(value: string, name: string): boolean {
  const v = value.toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  throw new Error(`${name} debe ser "true" o "false", recibí: ${value}`);
}

export function loadBaseConfig(): BaseConfig {
  const protocol = required("PROTOCOL").toLowerCase();

  const networkRaw = required("NETWORK").toLowerCase();
  if (networkRaw !== "mainnet" && networkRaw !== "devnet") {
    throw new Error(`NETWORK debe ser "mainnet" o "devnet", recibí: ${networkRaw}`);
  }
  const network = networkRaw as BaseConfig["network"];

  const rpcUrl = required("RPC_URL");

  const targetPrice = Number(required("TARGET_PRICE"));
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    throw new Error("TARGET_PRICE debe ser un número positivo");
  }

  const directionRaw = required("DIRECTION").toLowerCase();
  if (directionRaw !== "above" && directionRaw !== "below") {
    throw new Error(`DIRECTION debe ser "above" o "below", recibí: ${directionRaw}`);
  }
  const direction = directionRaw as Direction;

  const slippageBps = Number(required("SLIPPAGE_BPS"));
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("SLIPPAGE_BPS debe ser un entero entre 0 y 10000");
  }

  const pollMs = Number(required("POLL_MS"));
  if (!Number.isInteger(pollMs) || pollMs < 1000) {
    throw new Error("POLL_MS debe ser un entero >= 1000");
  }

  const walletPath = required("WALLET_PATH");

  const dryRun = parseBool(optional("DRY_RUN", "true"), "DRY_RUN");

  const exitTokenMintRaw = optional("EXIT_TOKEN_MINT", "");
  const exitTokenMint = exitTokenMintRaw === "" ? undefined : exitTokenMintRaw;

  const exitSwapSlippageBpsRaw = optional("EXIT_SWAP_SLIPPAGE_BPS", "");
  const exitSwapSlippageBps =
    exitSwapSlippageBpsRaw === "" ? slippageBps : Number(exitSwapSlippageBpsRaw);
  if (
    !Number.isInteger(exitSwapSlippageBps) ||
    exitSwapSlippageBps < 0 ||
    exitSwapSlippageBps > 10_000
  ) {
    throw new Error("EXIT_SWAP_SLIPPAGE_BPS debe ser un entero entre 0 y 10000");
  }

  // Cinturón y tirantes: ejecutar en mainnet con tx en vivo requiere consentimiento explícito.
  if (network === "mainnet" && !dryRun) {
    const allow = parseBool(
      optional("ALLOW_MAINNET_LIVE", "false"),
      "ALLOW_MAINNET_LIVE",
    );
    if (!allow) {
      throw new Error(
        "Bloqueado: NETWORK=mainnet con DRY_RUN=false requiere ALLOW_MAINNET_LIVE=true.",
      );
    }
  }

  return {
    protocol,
    network,
    rpcUrl,
    targetPrice,
    direction,
    slippageBps,
    pollMs,
    walletPath,
    dryRun,
    exitTokenMint,
    exitSwapSlippageBps,
  };
}
