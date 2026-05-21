"use client";

import Link from "next/link";
import { ServerStatus } from "./ServerStatus";
import { VaultChip } from "./VaultChip";
import { trpc } from "@/lib/trpc";

/**
 * Header global persistente. Logo a la izquierda (typo display + eyebrow
 * con la red activa — oxblood prominente cuando es mainnet, ADR-006/F4.3),
 * server status + vault chip a la derecha. Hairline al pie que separa
 * del resto.
 */
export function GlobalHeader() {
  const settings = trpc.settings.get.useQuery(undefined, {
    refetchInterval: 10_000,
  });
  const network = settings.data?.network ?? "devnet";
  const isMainnet = network === "mainnet";

  return (
    <header className="hairline-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5">
        <Link href="/" className="group shrink-0">
          <div className="t-h2 leading-none text-[var(--color-text)] group-hover:text-[var(--color-accent-bright)] transition-colors">
            Auto<span className="text-[var(--color-accent)]"> · </span>Exit
          </div>
          <div className="mt-1 t-eyebrow text-[var(--color-text-dim)]">
            on Orca <span className="text-[var(--color-text-dim)]/60">·</span>{" "}
            Meteora{" "}
            <span
              className={`hidden sm:inline ${
                isMainnet
                  ? "text-[var(--color-accent-bright)]"
                  : "text-[var(--color-text-dim)]"
              }`}
            >
              · {network}
            </span>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {isMainnet ? (
            <Link
              href="/settings"
              className="inline-flex h-8 items-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)] px-3 t-eyebrow text-[var(--color-accent-fg)] rounded-[2px] hover:bg-[var(--color-accent-bright)] hover:border-[var(--color-accent-bright)] transition-colors"
              title="Real funds — click to review network settings"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent-fg)] pulse-soft" />
              mainnet
            </Link>
          ) : null}
          <Link
            href="/docs"
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/settings"
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Settings
          </Link>
          <div className="hidden md:block">
            <ServerStatus />
          </div>
          <VaultChip />
        </div>
      </div>
    </header>
  );
}
