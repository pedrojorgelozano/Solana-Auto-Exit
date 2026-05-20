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
          <div className="t-eyebrow hidden text-[var(--color-text-dim)] sm:block">
            devnet · 127.0.0.1
          </div>
          <div className="t-h2 leading-none text-[var(--color-text)] group-hover:text-[var(--color-accent-bright)] transition-colors">
            auto<span className="text-[var(--color-accent)]">·</span>exit
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="hidden md:block">
            <ServerStatus />
          </div>
          <VaultChip />
        </div>
      </div>
    </header>
  );
}
