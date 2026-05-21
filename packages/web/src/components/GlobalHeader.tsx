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
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)] px-3.5 t-eyebrow text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-bright)] hover:border-[var(--color-accent-bright)] transition-colors"
              title="Real funds — click to review network settings"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent-fg)] pulse-soft" />
              mainnet
            </Link>
          ) : null}
          <Link
            href="/docs"
            aria-label="Docs"
            title="Docs"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-paper)] transition-colors"
          >
            <DocsIcon />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-paper)] transition-colors"
          >
            <SettingsIcon />
          </Link>
          <div className="hidden md:inline-flex md:h-9 md:items-center">
            <ServerStatus />
          </div>
          <VaultChip />
        </div>
      </div>
    </header>
  );
}

/**
 * Open book — encaja con el espíritu editorial "cuaderno" del estilo
 * global. Feather-style, mismo grosor y caja que SettingsIcon.
 */
function DocsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/**
 * Gear icon "tipo iOS" — feather-style line work, encaja con los demás
 * glyphs del header (Lock/Unlock del VaultChip). 18×18 a tamaño base.
 */
function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
