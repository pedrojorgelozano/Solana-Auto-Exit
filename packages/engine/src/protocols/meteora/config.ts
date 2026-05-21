/**
 * Config específica de un task Meteora DLMM. Como en F6.1 solo soportamos
 * lectura (no CLI watcher), esta interfaz es la mínima para resolver una
 * posición concreta.
 */
export interface MeteoraConfig {
  /** Public key del LbPair (pool) en base58. */
  lbPair: string;
  /** Public key de la posición (PDA derived from owner + lbPair + ...) en base58. */
  position: string;
  /** Decimales de los tokens X/Y. Necesarios para mostrar amounts con UI symbol. */
  decimalsX: number;
  decimalsY: number;
}

export function loadMeteoraConfig(env: NodeJS.ProcessEnv): MeteoraConfig {
  const lbPair = env.METEORA_LB_PAIR?.trim();
  const position = env.METEORA_POSITION?.trim();
  if (!lbPair || !position) {
    throw new Error(
      "Faltan METEORA_LB_PAIR y/o METEORA_POSITION en .env (Meteora DLMM).",
    );
  }
  return {
    lbPair,
    position,
    decimalsX: Number.parseInt(env.METEORA_DECIMALS_X ?? "9", 10),
    decimalsY: Number.parseInt(env.METEORA_DECIMALS_Y ?? "6", 10),
  };
}
