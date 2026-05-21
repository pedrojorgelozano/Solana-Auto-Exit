import type { ProtocolAdapter } from "./types.js";
import { OrcaAdapter } from "./orca/adapter.js";
import { MeteoraAdapter } from "./meteora/adapter.js";

export function makeAdapter(name: string): ProtocolAdapter {
  switch (name.toLowerCase()) {
    case "orca":
      return new OrcaAdapter();
    case "meteora":
      return new MeteoraAdapter();
    default:
      throw new Error(`Protocolo no soportado: ${name}`);
  }
}

/**
 * Lista de protocolos registrados. La UI puede iterarla para hacer
 * listOwned en paralelo o presentar selectores.
 */
export const REGISTERED_PROTOCOLS = ["orca", "meteora"] as const;
