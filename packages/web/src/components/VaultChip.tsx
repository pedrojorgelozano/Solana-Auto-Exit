"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/format";

/**
 * Indicador del vault en el header global. Funciona como pestillo / cerrojo:
 * candado cerrado → locked / no vault; candado abierto → unlocked.
 * Click → /wallet (donde se gestiona create / unlock / lock / delete).
 */
export function VaultChip() {
  const status = trpc.wallet.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  if (status.isLoading) {
    return (
      <ChipLink href="/wallet" tone="neutral">
        <Lock /> vault
      </ChipLink>
    );
  }

  if (!status.data?.hasVault) {
    return (
      <ChipLink href="/wallet" tone="warning">
        <Lock /> no vault
      </ChipLink>
    );
  }

  if (!status.data.unlocked) {
    return (
      <ChipLink href="/wallet" tone="neutral">
        <Lock />
        vault locked
        {status.data.address ? (
          <span className="ml-2 t-num text-[var(--color-text-dim)]">
            {truncateAddress(status.data.address, 4, 4)}
          </span>
        ) : null}
      </ChipLink>
    );
  }

  return (
    <ChipLink href="/wallet" tone="active">
      <Unlock />
      vault unlocked
      {status.data.address ? (
        <span className="ml-2 t-num text-[var(--color-text)]">
          {truncateAddress(status.data.address, 4, 4)}
        </span>
      ) : null}
    </ChipLink>
  );
}

function ChipLink({
  href,
  tone,
  children,
}: {
  href: string;
  tone: "active" | "warning" | "neutral";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "active"
      ? "border-[var(--color-positive)]/40 text-[var(--color-positive)] hover:bg-[var(--color-positive-bg)]"
      : tone === "warning"
        ? "border-[var(--color-warning)]/40 text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]"
        : "border-[var(--color-hairline)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]";

  return (
    <Link
      href={href}
      className={`inline-flex h-8 items-center gap-2 border px-3 t-eyebrow transition-colors rounded-[2px] ${toneClass}`}
    >
      {children}
    </Link>
  );
}

// Glyph icons inline (no librería)
function Lock() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="5.5"
        width="7"
        height="5"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M4 5.5V4a2 2 0 1 1 4 0v1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function Unlock() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="5.5"
        width="7"
        height="5"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M4 5.5V4a2 2 0 0 1 4 0" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
