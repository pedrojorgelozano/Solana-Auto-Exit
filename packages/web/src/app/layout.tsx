import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { Sidebar } from "@/components/Sidebar";
import { LangProvider } from "@/i18n/context";
import { fraunces, sourceSerif, jetbrainsMono } from "./fonts";

export const metadata: Metadata = {
  title: "Auto-exit · Solana",
  description:
    "Watch concentrated liquidity positions on Solana and exit on a price trigger. Take-profit, stop-loss, optional swap to a stable.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        {/* LangProvider va POR FUERA de Providers porque `Providers`
            renderiza `<ConnectWalletModal />` (montado globalmente para
            que sea invocable desde cualquier sitio vía useConnectWallet),
            y ese modal llama useT(). LangProvider es solo React state +
            localStorage, sin dependencia del trpc client. */}
        <LangProvider>
          <Providers>
            <div className="relative z-10 grid min-h-screen md:grid-cols-[252px_1fr]">
              <Sidebar />
              <div className="min-w-0">{children}</div>
            </div>
          </Providers>
        </LangProvider>
      </body>
    </html>
  );
}
