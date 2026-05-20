import Link from "next/link";
import { ServerStatus } from "@/components/ServerStatus";

function NavTile({
  href,
  step,
  title,
  description,
}: {
  href: string;
  step: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 transition-colors hover:border-[var(--color-accent)]/60"
    >
      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        Step {step}
      </div>
      <div className="mt-2 text-lg font-medium">{title}</div>
      <div className="mt-1 text-sm text-[var(--color-text-muted)]">
        {description}
      </div>
    </Link>
  );
}

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

      <nav className="mt-12 grid gap-3 sm:grid-cols-3">
        <NavTile
          href="/wallet"
          step="1"
          title="Wallet"
          description="Create or unlock your encrypted vault."
        />
        <NavTile
          href="/positions"
          step="2"
          title="Positions"
          description="See the liquidity positions owned by your bot wallet."
        />
        <NavTile
          href="/tasks"
          step="3"
          title="Tasks"
          description="Watch armed and finished auto-exits."
        />
      </nav>
    </main>
  );
}
