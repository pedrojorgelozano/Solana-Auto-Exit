"use client";

import { useState } from "react";
import { truncateAddress } from "@/lib/format";
import { useT } from "@/i18n/context";
import { TextAction } from "@/components/ui/TextAction";
import { ExternalLink } from "@/components/ui/ExternalLink";

/**
 * Display de address Solana con tres affordances útiles:
 *  - Truncado por default (`abcd…wxyz`) para no abrumar.
 *  - Botón Copy al portapapeles, con feedback visual ~1.5s.
 *  - Toggle "Mostrar completa" para usuarios técnicos.
 *  - Link "Ver en Solscan" — abre el explorer con el cluster correcto.
 *
 * Los 3 affordances usan los primitives globales (TextAction +
 * ExternalLink) para hablar el mismo idioma visual que el resto de la
 * página — no su propio mini-sistema con iconos SVG. Cuando la copia es
 * exitosa el texto cambia a "Copied" durante ~1.5s.
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <TextAction onClick={copy}>
          {copied ? w.copied : w.copy}
        </TextAction>
        <TextAction onClick={() => setShowFull((v) => !v)}>
          {showFull ? w.showTruncated : w.showFull}
        </TextAction>
        <ExternalLink href={solscanUrl}>{w.viewOnExplorer}</ExternalLink>
      </div>
    </div>
  );
}
