"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";

import { trpc, TRPC_URL } from "./trpc";
import { ConnectWalletProvider } from "./connect-wallet";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Datos del bot tienen vida corta — staleTime bajo para no
            // mostrar precios viejos. Ajustar por pantalla si hace falta.
            staleTime: 5_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: TRPC_URL,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ConnectWalletProvider>
          {children}
          <ConnectWalletModal />
        </ConnectWalletProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
