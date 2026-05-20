import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { fraunces, instrumentSans, jetbrainsMono } from "./fonts";

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
      className={`${fraunces.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="grain-overlay min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
