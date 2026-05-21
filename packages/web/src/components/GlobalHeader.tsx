import Link from "next/link";
import { ServerStatus } from "./ServerStatus";
import { VaultChip } from "./VaultChip";

/**
 * Header global persistente. Logo a la izquierda (typo display + eyebrow
 * con la red), server status + vault chip a la derecha. Hairline al pie
 * que separa del resto.
 */
export function GlobalHeader() {
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
            <span className="hidden text-[var(--color-text-dim)] sm:inline">
              · devnet
            </span>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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
