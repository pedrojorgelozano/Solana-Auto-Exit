import { ServerStatus } from "@/components/ServerStatus";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
          <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            devnet · localhost
          </span>
        </div>
        <ServerStatus />
      </div>

      <h1 className="mt-6 text-5xl font-semibold tracking-tight">
        solana-auto-exit
      </h1>
      <p className="mt-3 max-w-xl text-[var(--color-text-muted)]">
        Watch your concentrated liquidity positions on Solana and exit on a
        price trigger. Take-profit or stop-loss, with optional swap to a
        stable token.
      </p>

      <div className="mt-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          F1.2 status
        </div>
        <div className="mt-2 text-lg">
          tRPC client wired to the backend. The badge above polls{" "}
          <code className="text-[var(--color-accent)]">health</code> every 10s.
        </div>
        <div className="mt-4 text-sm text-[var(--color-text-muted)]">
          Next: wallet management screens (F1.3).
        </div>
      </div>
    </main>
  );
}
