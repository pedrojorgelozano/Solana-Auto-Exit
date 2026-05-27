"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n/context";

/**
 * Header de página interna (rediseño "refined minimal dark"). Patrón del
 * mockup `.view-head`: eyebrow + título sans-bold + deck + slot de acciones
 * a la derecha, hairline al pie.
 *
 * Compatibilidad con la API anterior:
 * - `title`, `eyebrow`, `description`, `back` siguen funcionando igual.
 * - `description` ahora acepta `ReactNode` para poder embeber acentos
 *   `.serif-it` o números inline; el caller pasa el string normal o JSX.
 *
 * Añadido:
 * - `actions?` — slot a la derecha (para CTAs, filtros, etc.).
 * - `showNetworkPill?` (default true) — muestra automáticamente la
 *   network pill (Mainnet · Live / Test · devnet) leyendo `settings.get`.
 *   Las páginas educativas (/docs/*) usan su propio ArticleHeader, así
 *   que no se ven afectadas.
 */
export function PageHeader({
  title,
  description,
  back,
  eyebrow,
  actions,
  showNetworkPill = true,
}: {
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: string;
  actions?: ReactNode;
  showNetworkPill?: boolean;
}) {
  return (
    <header className="mb-8 flex flex-col gap-3 border-b border-[var(--color-hairline)] pb-6 md:flex-row md:items-end md:justify-between md:gap-6">
      {/* Bloque izquierdo: back link + eyebrow + título + descripción */}
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="t-eyebrow text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            ← {back.label}
          </Link>
        ) : null}

        {eyebrow ? (
          <div
            className={`${back ? "mt-6" : ""} t-eyebrow text-[var(--color-text-dim)]`}
          >
            {eyebrow}
          </div>
        ) : null}

        <h1 className={`${eyebrow || back ? "mt-2" : ""} t-h1`}>{title}</h1>

        {description ? (
          <div className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-[var(--color-text-muted)]">
            {description}
          </div>
        ) : null}
      </div>

      {/* Bloque derecho: pill + acciones */}
      {(showNetworkPill || actions) ? (
        <div className="flex flex-none items-center gap-3">
          {showNetworkPill ? <NetworkPill /> : null}
          {actions}
        </div>
      ) : null}
    </header>
  );
}

/**
 * Pill de network. Lee `settings.get` (la query es la misma cacheada de
 * tRPC + TanStack — montar la pill en cada página NO hace fetches extra).
 *
 * - Mainnet: rust con icono de alerta. "Live" para que el user nunca olvide
 *   que toda firma usa fondos reales.
 * - Devnet (test): amber con icono de signo "menos" (test/valueless).
 */
function NetworkPill() {
  const settings = trpc.settings.get.useQuery(undefined, {
    refetchInterval: 10_000,
  });
  const { t } = useT();
  const network = settings.data?.network;

  if (!network) return null;

  if (network === "mainnet") {
    return (
      <span
        className="
          inline-flex items-center gap-2 rounded-full
          border border-[var(--color-danger)] bg-[var(--color-danger-bg)]
          px-3 py-[5px] text-[11px] font-semibold uppercase tracking-[0.1em]
          text-[var(--color-danger)]
        "
        title={t.header.mainnetLiveTooltip}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-3 w-3" aria-hidden="true">
          <path d="M12 8v5M12 16.5v.5" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        {t.header.mainnetLive}
      </span>
    );
  }

  return (
    <Link
      href="/settings"
      className="
        inline-flex items-center gap-2 rounded-full
        border border-[var(--color-warning)] bg-[var(--color-warning-bg)]
        px-3 py-[5px] text-[11px] font-semibold uppercase tracking-[0.1em]
        text-[var(--color-warning)] transition-colors
        hover:bg-[var(--color-warning)] hover:text-[var(--color-bg)]
      "
      title={t.header.testModeTooltip}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3 w-3" aria-hidden="true">
        <path d="M5 12h14" />
      </svg>
      {t.header.testMode}
    </Link>
  );
}
