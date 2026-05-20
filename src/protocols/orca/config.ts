export interface OrcaConfig {
  positionMint: string;
  decimalsA: number;
  decimalsB: number;
}

function parseDecimals(value: string | undefined, name: string): number {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Falta variable de entorno requerida: ${name}`);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 18) {
    throw new Error(`${name} debe ser un entero entre 0 y 18, recibí: ${value}`);
  }
  return n;
}

export function loadOrcaConfig(env: NodeJS.ProcessEnv): OrcaConfig {
  const positionMint = env.ORCA_POSITION_MINT?.trim();
  if (!positionMint) {
    throw new Error("Falta variable de entorno requerida: ORCA_POSITION_MINT");
  }
  return {
    positionMint,
    decimalsA: parseDecimals(env.ORCA_DECIMALS_A, "ORCA_DECIMALS_A"),
    decimalsB: parseDecimals(env.ORCA_DECIMALS_B, "ORCA_DECIMALS_B"),
  };
}
