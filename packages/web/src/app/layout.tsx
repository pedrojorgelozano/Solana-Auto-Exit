import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { GlobalHeader } from "@/components/GlobalHeader";
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
        <Providers>
          <GlobalHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
