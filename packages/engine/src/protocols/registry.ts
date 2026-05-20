import type { ProtocolAdapter } from "./types.js";
import { OrcaAdapter } from "./orca/adapter.js";

export function makeAdapter(name: string): ProtocolAdapter {
  switch (name.toLowerCase()) {
    case "orca":
      return new OrcaAdapter();
    case "meteora":
      throw new Error(
        "Protocolo 'meteora' aún no implementado (Fase 2). Ver src/protocols/meteora/README.md",
      );
    default:
      throw new Error(`Protocolo no soportado: ${name}`);
  }
}
