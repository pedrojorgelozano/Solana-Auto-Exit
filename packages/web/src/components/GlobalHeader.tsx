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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
        <Link href="/" className="group">
          <div className="t-eyebrow text-[var(--color-text-dim)]">
            devnet · 127.0.0.1
          </div>
          <div className="t-h2 leading-none text-[var(--color-text)] group-hover:text-[var(--color-accent-bright)] transition-colors">
            auto<span className="text-[var(--color-accent)]">·</span>exit
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <ServerStatus />
          <VaultChip />
        </div>
      </div>
    </header>
  );
}
