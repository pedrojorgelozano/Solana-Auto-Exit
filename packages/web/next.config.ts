import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // En dev, el backend tRPC corre en 7777. Si quieres proxearlo a través
  // de Next para evitar configurar CORS, descomenta. Por ahora preferimos
  // CORS en el server de Hono para mantener la separación clara.
  // async rewrites() {
  //   return [{ source: "/api/trpc/:path*", destination: "http://127.0.0.1:7777/trpc/:path*" }];
  // },
};

export default nextConfig;
