import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@solana-auto-exit/server/api";

/**
 * Cliente tRPC tipado. El AppRouter se importa del paquete server vía
 * workspace dep — los tipos viajan, no el código (gracias a tsx + bundler
 * resolution). Si añades un router nuevo en el server, aquí aparece sin
 * tocar nada.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * URL del backend tRPC. Configurable por env en build-time. Default coincide
 * con el bind por defecto del server (127.0.0.1:7777, ADR-016).
 */
export const TRPC_URL =
  process.env.NEXT_PUBLIC_TRPC_URL ?? "http://127.0.0.1:7777/trpc";
