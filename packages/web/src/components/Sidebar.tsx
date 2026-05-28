"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/format";
import { useConnectWallet } from "@/lib/connect-wallet";
import { useT } from "@/i18n/context";
import { LangToggle } from "@/i18n/LangToggle";

/**
 * Sidebar lateral persistente. Reemplaza al GlobalHeader del rediseño
 * anterior. Mockup: refined-minimal-dark.html, sección `.sidebar`.
 *
 * Estructura:
 *   - Brand (logo + nombre + subtitle)
 *   - Nav primaria: Dashboard / Wallet / Positions / Auto-exits / Settings
 *     (mantenemos todas las páginas actuales — el mockup tiene 3, nosotros
 *     tenemos 5; añadir items al sidebar respeta la regla "ninguna
 *     funcionalidad suprimida".)
 *   - Footer: server beacon · wallet beacon · Lock button · Docs · EN/ES
 *
 * Responsive: en <860px la sidebar colapsa en una fila arriba (CSS de
 * `globals.css` no la rige; aquí usamos clases tailwind directamente).
 */
export function Sidebar() {
  const { t } = useT();

  return (
    <aside
      className="
        relative z-10 flex flex-col gap-1
        border-b md:border-b-0 md:border-r border-[var(--color-hairline)]
        bg-gradient-to-b from-[var(--color-paper)] to-[var(--color-bg)]
        md:sticky md:top-0 md:h-screen
        px-5 py-5 md:px-[18px] md:py-[26px]
      "
      aria-label={t.sidebar.aria.primary}
    >
      <Brand />
      <Nav />
      <SidebarFoot />
    </aside>
  );
}

// ============================================================================
// Brand
// ============================================================================

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2 pb-6 group">
      <span
        className="
          inline-flex h-[34px] w-[34px] items-center justify-center flex-none
          rounded-[9px] border border-[var(--color-rule)]
          bg-[var(--color-accent-dim)]
          text-[18px] font-bold leading-none tracking-tight
          text-[var(--color-accent)]
        "
        style={{ fontFamily: "var(--font-mono)" }}
        aria-hidden="true"
      >
        A
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[15px] font-bold tracking-tight text-[var(--color-text)] group-hover:text-[var(--color-accent-bright)] transition-colors">
          Auto-Exit
        </span>
        <span className="text-[13px] tracking-wide text-[var(--color-text-dim)]">
          Solana · self-hosted
        </span>
      </span>
    </Link>
  );
}

// ============================================================================
// Nav primaria
// ============================================================================

function Nav() {
  const { t } = useT();
  const pathname = usePathname() ?? "/";

  // Match: la ruta actual es exactamente la nav-href o empieza por ella + "/"
  // (para que /tasks/[id] resalte "Auto-exits", /positions/[mint] resalte
  // "Positions", etc.). Excepción: "/" solo se considera activo si pathname
  // es exactamente "/" — si no, cualquier ruta haría match con "/".
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  // /positions standalone es un redirect al home (el listado de posiciones
  // con auto-exit por row vive en el dashboard) — no debe aparecer en el
  // nav. /positions/[mint] sigue activo para la pantalla de configure pero
  // se accede desde una row del home, no desde nav.
  const items: Array<{ href: string; label: string; icon: React.ReactNode }> = [
    { href: "/", label: t.sidebar.nav.dashboard, icon: <DashboardIcon /> },
    { href: "/tasks", label: t.sidebar.nav.autoExits, icon: <AutoExitIcon /> },
    { href: "/wallet", label: t.sidebar.nav.wallet, icon: <WalletIcon /> },
    { href: "/settings", label: t.sidebar.nav.settings, icon: <SettingsIcon /> },
  ];

  return (
    <nav className="flex flex-col gap-[3px] pt-1" aria-label={t.sidebar.aria.primary}>
      <span className="px-[10px] pb-1.5 pt-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-dim)]">
        {t.sidebar.workspaceLabel}
      </span>
      {items.map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`
              relative flex items-center gap-[11px] rounded-[7px] px-[11px] py-[9px]
              text-[14px] font-medium transition-colors
              ${active
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-text)] font-semibold"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"}
            `}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="absolute -left-[18px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-[var(--color-accent)]"
              />
            ) : null}
            <span
              className={`h-[17px] w-[17px] flex-none ${active ? "text-[var(--color-accent)] opacity-100" : "opacity-85"}`}
              aria-hidden="true"
            >
              {it.icon}
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ============================================================================
// Sidebar foot — beacons + lock + docs + lang
// ============================================================================

function SidebarFoot() {
  return (
    <div className="mt-auto flex flex-col gap-[2px] pt-4">
      <ServerBeacon />
      <WalletBeacon />
      <div className="mt-3 flex items-center justify-between gap-2 px-1">
        <DocsLink />
        <LangToggle />
      </div>
    </div>
  );
}

function ServerBeacon() {
  const health = trpc.health.useQuery(undefined, { refetchInterval: 10_000 });
  const { t } = useT();
  const tone: "ok" | "danger" | "neutral" = health.error
    ? "danger"
    : health.isLoading
      ? "neutral"
      : "ok";
  const beaconColor =
    tone === "ok"
      ? "bg-[var(--color-accent)]"
      : tone === "danger"
        ? "bg-[var(--color-danger)]"
        : "bg-[var(--color-text-muted)]";
  return (
    <div
      className="flex items-center gap-[9px] rounded-[7px] px-[10px] py-[9px]"
      title={health.error?.message}
    >
      <span
        className={`inline-block h-[7px] w-[7px] flex-none rounded-full ${beaconColor} ${tone === "ok" ? "shadow-[0_0_0_3px_var(--color-accent-dim)]" : ""}`}
        aria-hidden="true"
      />
      <span className="text-[14px] text-[var(--color-text-muted)]">
        {t.sidebar.serverLabel}
      </span>
      <span className="ml-auto t-num text-[13px] text-[var(--color-text-dim)]">
        127.0.0.1:7777
      </span>
    </div>
  );
}

function WalletBeacon() {
  const status = trpc.wallet.status.useQuery(undefined, { refetchInterval: 5_000 });
  const connect = useConnectWallet();
  const { t } = useT();

  if (status.isLoading) {
    return (
      <div className="flex items-center gap-[9px] rounded-[7px] border-y border-[var(--color-hairline)] px-[10px] py-[9px]">
        <span className="inline-block h-[7px] w-[7px] flex-none rounded-full bg-[var(--color-text-muted)]" />
        <span className="text-[14px] text-[var(--color-text-muted)]">
          {t.sidebar.walletLabel}
        </span>
      </div>
    );
  }

  if (!status.data?.hasVault) {
    return (
      <button
        type="button"
        onClick={connect.open}
        className="
          flex items-center gap-[9px] rounded-[7px] border-y border-[var(--color-hairline)]
          px-[10px] py-[9px] text-left transition-colors
          hover:bg-[var(--color-surface-hover)]
        "
      >
        <span className="inline-block h-[7px] w-[7px] flex-none rounded-full bg-[var(--color-accent)] shadow-[0_0_0_3px_var(--color-accent-dim)]" />
        <span className="text-[14px] text-[var(--color-accent)]">
          {t.sidebar.setupWallet}
        </span>
      </button>
    );
  }

  const beacon = status.data.unlocked
    ? "bg-[var(--color-accent)] shadow-[0_0_0_3px_var(--color-accent-dim)]"
    : "bg-[var(--color-warning)]";
  const addr = status.data.address
    ? truncateAddress(status.data.address, 4, 4)
    : "—";

  return (
    <Link
      href="/wallet"
      className="
        flex items-center gap-[9px] rounded-[7px] border-y border-[var(--color-hairline)]
        px-[10px] py-[9px] transition-colors hover:bg-[var(--color-surface-hover)]
      "
    >
      <span className={`inline-block h-[7px] w-[7px] flex-none rounded-full ${beacon}`} />
      <span className="text-[14px] text-[var(--color-text-muted)]">
        {t.sidebar.walletLabel}
      </span>
      <span
        className={`ml-auto t-num text-[13px] ${status.data.unlocked ? "text-[var(--color-text)]" : "text-[var(--color-text-dim)]"}`}
      >
        {addr}
      </span>
    </Link>
  );
}

function DocsLink() {
  const { t } = useT();
  return (
    <Link
      href="/docs"
      title={t.sidebar.docs}
      aria-label={t.sidebar.docs}
      className="
        inline-flex h-9 items-center justify-center gap-2 rounded-full
        px-3 text-[14px] font-semibold tracking-wider uppercase
        text-[var(--color-text-muted)] transition-colors
        hover:text-[var(--color-text)]
      "
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[14px] w-[14px]"
        aria-hidden="true"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
      {t.sidebar.docs}
    </Link>
  );
}

// ============================================================================
// Icons — feather-style, 17x17 base (set en parent con className)
// ============================================================================

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16 14.5h2" />
    </svg>
  );
}

function PositionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M3 17l5-5 4 4 8-9" />
      <path d="M14 7h6v6" />
    </svg>
  );
}

function AutoExitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1.6" />
      <circle cx="3.5" cy="12" r="1.6" />
      <circle cx="3.5" cy="18" r="1.6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}
