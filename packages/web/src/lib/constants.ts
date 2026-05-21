/**
 * Constantes que F3.3 movió en su mayoría a settings.get. Aquí solo viven
 * los fallbacks de seguridad para cuando la query de settings aún no ha
 * resuelto, y el listado de protocolos soportados (estable en el cliente
 * porque añadir uno nuevo es un release del frontend de todos modos).
 */
export const NETWORK = "devnet" as const;
export const RPC_URL = "https://api.devnet.solana.com";
export const PROTOCOL = "orca" as const;

/**
 * Protocolos que la UI consulta en paralelo desde `/positions`. F6.1
 * añade Meteora (read-only); F6.2/F6.3 abrirán el path completo de
 * cierre + swap. Si añades uno nuevo, también regístralo en
 * `packages/engine/src/protocols/registry.ts`.
 */
export const PROTOCOLS = ["orca", "meteora"] as const;
export type ProtocolName = (typeof PROTOCOLS)[number];

/** Display name human-readable para cada protocolo. */
export const PROTOCOL_LABELS: Record<ProtocolName, string> = {
  orca: "Orca",
  meteora: "Meteora",
};
