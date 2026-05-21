"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/format";
import { useConnectWallet } from "@/lib/connect-wallet";

/**
 * Indicador del wallet en el header global. Cuando NO hay wallet (estado
 * de onboarding) actúa como botón "connect wallet" y abre el modal. Cuando
 * sí hay wallet (locked/unlocked) es un link a /wallet para gestionarla.
 */
export function VaultChip() {
  const status = trpc.wallet.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });
  const connect = useConnectWallet();

  if (status.isLoading) {
    return (
      <ChipFrame tone="neutral">
        <Lock /> wallet
      </ChipFrame>
    );
  }

  if (!status.data?.hasVault) {
    return (
      <button
        type="button"
        onClick={connect.open}
        className={chipClass("accent")}
      >
        <Lock /> set up wallet
      </button>
    );
  }

  if (!status.data.unlocked) {
    return (
      <Link href="/wallet" className={chipClass("neutral")}>
        <Lock />
        wallet locked
        {status.data.address ? (
          <span className="ml-2 t-num text-[var(--color-text-dim)]">
            {truncateAddress(status.data.address, 4, 4)}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Link href="/wallet" className={chipClass("active")}>
      <Unlock />
      wallet unlocked
      {status.data.address ? (
        <span className="ml-2 t-num text-[var(--color-text)]">
          {truncateAddress(status.data.address, 4, 4)}
        </span>
      ) : null}
    </Link>
  );
}

function chipClass(tone: "active" | "accent" | "neutral"): string {
  const toneClass =
    tone === "active"
      ? "border-[var(--color-positive)]/40 text-[var(--color-positive)] hover:bg-[var(--color-positive-bg)]"
      : tone === "accent"
        ? "border-[var(--color-accent)] text-[var(--color-accent-bright)] hover:bg-[var(--color-accent-dim)]"
        : "border-[var(--color-hairline)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]";
  return `inline-flex h-9 items-center gap-2 border px-3.5 t-eyebrow transition-colors rounded-full ${toneClass}`;
}

function ChipFrame({
  tone,
  children,
}: {
  tone: "active" | "accent" | "neutral";
  children: React.ReactNode;
}) {
  return <span className={chipClass(tone)}>{children}</span>;
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
