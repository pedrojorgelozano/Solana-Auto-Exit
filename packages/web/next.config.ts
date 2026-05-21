import type { NextConfig } from "next";

/**
 * Dos modos de construcción:
 *
 *  - **dev / vercel-style build**: `pnpm dev:web` o `pnpm build:web` sin
 *    `TAURI_BUILD=1`. Next.js sirve con HMR y server components — el camino
 *    actual de desarrollo y de la build Docker.
 *
 *  - **static export para Tauri**: `TAURI_BUILD=1 pnpm build:web` produce
 *    `packages/web/out/` con HTML estático puro, sin Node runtime, listo
 *    para que Tauri lo bundlee. Las dynamic routes (`[mint]`, `[id]`) se
 *    pre-generan con un placeholder; el contenido real se renderiza
 *    client-side leyendo `useParams()`.
 *
 * El flag por env-var (en vez de dos configs) mantiene un solo source of
 * truth y evita drift entre los dos modos.
 */
const isTauriBuild = process.env.TAURI_BUILD === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isTauriBuild
    ? {
        output: "export" as const,
        // El dev server de Next con HMR sirve URLs sin trailing slash. Para
        // que los HTML estáticos generados respeten el mismo shape al
        // moverlos al bundle Tauri, usamos trailingSlash:false (default).
        // Imágenes optimizadas no funcionan en static export (no hay server
        // que las procese on-demand). Desactivamos.
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
