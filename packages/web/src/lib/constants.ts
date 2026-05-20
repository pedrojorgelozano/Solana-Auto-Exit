/**
 * Constantes de red usadas mientras no haya pantalla de Settings (F3).
 * Cuando lleguemos a F3 estas vendrán de wallet.status o de un router
 * de settings; por ahora hardcoded a devnet (ADR-006).
 */
export const NETWORK = "devnet" as const;
export const RPC_URL = "https://api.devnet.solana.com";
export const PROTOCOL = "orca" as const;
