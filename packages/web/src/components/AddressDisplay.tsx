"use client";

import { useState } from "react";
import { truncateAddress } from "@/lib/format";
import { useT } from "@/i18n/context";

/**
 * Display de address Solana con tres affordances útiles:
 *  - Truncado por default (`abcd…wxyz`) para no abrumar.
 *  - Botón Copy al portapapeles, con feedback visual ~1.5s.
 *  - Toggle "Mostrar completa" para usuarios técnicos.
 *  - Link "Ver en Solscan" — abre el explorer con el cluster correcto.
 *
 * La address es información pública (cualquiera puede ver balance y txs
 * en un explorer), así que la única razón para ocultarla es estética /
 * de respiración visual, no de seguridad.
 */
export function AddressDisplay({
  address,
  network,
  size = "md",
}: {
  address: string;
  network: "mainnet" | "devnet";
  /** "md" para el detail del wallet (24px mono); "sm" para listas. */
  size?: "sm" | "md";
}) {
  const { t } = useT();
  const w = t.wallet.unlocked.addressDisplay;
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard puede fallar en algunos contextos — ignoramos */
    }
  };

  const display = showFull ? address : truncateAddress(address, 8, 6);
  const cluster = network === "mainnet" ? "" : "?cluster=devnet";
  const solscanUrl = `https://solscan.io/account/${address}${cluster}`;

  const valueClass =
    size === "md"
      ? "text-[22px] md:text-[24px] break-all font-medium tracking-tight"
      : "text-[15px] break-all";

  return (
    <div className="flex flex-col gap-3">
      <div className={`t-num text-[var(--color-text)] ${valueClass}`}>
        {display}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 t-eyebrow">
        <button
          type="button"
          onClick={copy}
          className={`
            inline-flex items-center gap-1.5
            transition-colors
            ${
              copied
                ? "text-[var(--color-accent-bright)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)]"
            }
          `}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[12px] w-[12px]"
            aria-hidden
          >
            {copied ? (
              <path d="M5 12l5 5L20 7" />
            ) : (
              <>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </>
            )}
          </svg>
          {copied ? w.copied : w.copy}
        </button>

        <button
          type="button"
          onClick={() => setShowFull((v) => !v)}
          className="
            inline-flex items-center
            text-[var(--color-text-muted)] transition-colors
            hover:text-[var(--color-accent-bright)]
          "
        >
          {showFull ? w.showTruncated : w.showFull}
        </button>

        <a
          href={solscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="
            inline-flex items-center gap-1.5
            text-[var(--color-text-muted)] transition-colors
            hover:text-[var(--color-accent-bright)]
          "
        >
          {w.viewOnExplorer}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[11px] w-[11px]"
            aria-hidden
          >
            <path d="M7 17 17 7M10 7h7v7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
