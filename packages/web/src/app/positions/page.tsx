"use client";

import Link from "next/link";
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import {
  NETWORK,
  PROTOCOL_LABELS,
  type ProtocolName,
  RPC_URL,
} from "@/lib/constants";
import { formatPrice, formatRangeStatus, formatTokenAmount } from "@/lib/format";
import { tokenSymbol } from "@/lib/tokens";

type PositionRef = inferRouterOutputs<AppRouter>["positions"]["listOwned"][number];

export default function PositionsPage() {
  const status = trpc.wallet.status.useQuery();

  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow="Positions"
        title="Open liquidity positions."
        description="Owned by your unlocked bot wallet. Pick one to set an exit trigger."
        back={{ href: "/", label: "Home" }}
      />
      <Body
        status={status.data}
        loading={status.isLoading}
        error={status.error?.message ?? null}
      />
    </main>
  );
}

function Body({
  status,
  loading,
  error,
}: {
  status?: { hasVault: boolean; unlocked: boolean; address: string | null };
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <p className="t-small text-[var(--color-text-muted)]">Loading…</p>;
  }
  if (error) {
    return <p className="t-small text-[var(--color-danger)]">{error}</p>;
  }
  if (!status?.hasVault) return <NeedVault />;
  if (!status.unlocked) return <NeedUnlock />;
  return <OwnedList owner={status.address!} />;
}

function NeedVault() {
  return (
    <section className="hairline-t pt-10">
      <div className="t-eyebrow text-[var(--color-warning)]">No wallet</div>
      <h2 className="mt-3 t-h2">Set up the bot wallet first.</h2>
      <p className="mt-3 max-w-md t-body text-[var(--color-text-muted)]">
        Without a key, the server can&apos;t read positions or sign closes.
        Pick a setup path on the wallet page.
      </p>
      <div className="mt-6">
        <Link href="/wallet">
          <Button>Go to wallet →</Button>
        </Link>
      </div>
    </section>
  );
}

function NeedUnlock() {
  return (
    <section className="hairline-t pt-10">
      <div className="t-eyebrow text-[var(--color-text-muted)]">Wallet is locked</div>
      <h2 className="mt-3 t-h2">Unlock to list your positions.</h2>
      <div className="mt-6">
        <Link href="/wallet">
          <Button>Unlock wallet →</Button>
        </Link>
      </div>
    </section>
  );
}

function OwnedList({ owner }: { owner: string }) {
  // Desde F3.3 el RPC URL sale de settings; constants es solo fallback.
  const settings = trpc.settings.get.useQuery();
  const rpcUrl = settings.data?.rpcUrl ?? RPC_URL;
  const network = settings.data?.network ?? NETWORK;

  // F6.1.b: consultamos cada protocolo registrado en paralelo. React Query
  // ejecuta las useQuery concurrentemente; merge se hace en el render.
  const orcaList = trpc.positions.listOwned.useQuery({
    protocol: "orca",
    network,
    rpcUrl,
    owner,
  });
  const meteoraList = trpc.positions.listOwned.useQuery({
    protocol: "meteora",
    network,
    rpcUrl,
    owner,
  });

  // Tasks activas indexadas por positionId — para señalar cuáles posiciones
  // ya tienen un auto-exit configurado.
  const tasks = trpc.tasks.list.useQuery(undefined, { refetchInterval: 5_000 });
  const activeByPosition = new Map<string, string>();
  for (const t of tasks.data ?? []) {
    if (["idle", "armed", "triggered", "closing", "paused"].includes(t.status)) {
      activeByPosition.set(t.positionId, t.id);
    }
  }

  const isLoadingAll = orcaList.isLoading && meteoraList.isLoading;
  const allRefs = [...(orcaList.data ?? []), ...(meteoraList.data ?? [])];
  const refresh = () => {
    orcaList.refetch();
    meteoraList.refetch();
  };

  if (isLoadingAll) {
    return (
      <p className="t-small text-[var(--color-text-muted)]">
        Querying the chain for {PROTOCOLS_LABEL} positions of this wallet…
      </p>
    );
  }

  // Si los DOS protocolos erroraron, mostramos el error de Orca (Meteora
  // como red secundaria). Si solo uno, lo enseñamos inline pero seguimos
  // renderizando los datos del otro.
  if (orcaList.error && meteoraList.error) {
    return (
      <div>
        <p className="t-small text-[var(--color-danger)]">
          {orcaList.error.message}
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={refresh}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (allRefs.length === 0) {
    return <EmptyOwnedList owner={owner} refresh={refresh} />;
  }

  return (
    <div>
      <div className="flex items-baseline justify-between hairline-b pb-4">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {allRefs.length} {allRefs.length === 1 ? "position" : "positions"}
          {orcaList.isLoading || meteoraList.isLoading ? (
            <span className="ml-2 text-[var(--color-text-dim)]">· still loading</span>
          ) : null}
        </div>
        <button
          onClick={refresh}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          refresh
        </button>
      </div>
      {orcaList.error ? (
        <ProtocolErrorRow protocol="orca" message={orcaList.error.message} />
      ) : null}
      {meteoraList.error ? (
        <ProtocolErrorRow protocol="meteora" message={meteoraList.error.message} />
      ) : null}
      <ul className="divide-y divide-[var(--color-hairline)]">
        {allRefs.map((ref) => (
          <PositionRow
            key={`${ref.protocol}:${ref.id}`}
            posRef={ref}
            activeTaskId={activeByPosition.get(ref.id) ?? null}
          />
        ))}
      </ul>
    </div>
  );
}

const PROTOCOLS_LABEL = "Orca + Meteora";

function ProtocolErrorRow({
  protocol,
  message,
}: {
  protocol: "orca" | "meteora";
  message: string;
}) {
  return (
    <div className="hairline-b py-3">
      <span className="t-eyebrow text-[var(--color-danger)]">
        {PROTOCOL_LABELS[protocol]} failed
      </span>
      <span className="ml-2 t-small text-[var(--color-text-muted)]">
        {message}
      </span>
    </div>
  );
}

function PositionRow({
  posRef,
  activeTaskId,
}: {
  posRef: PositionRef;
  activeTaskId: string | null;
}) {
  // Reuse del cache de settings (TanStack Query deduplica con OwnedList).
  const settings = trpc.settings.get.useQuery();
  const summary = trpc.positions.getSummary.useQuery({
    protocol: posRef.protocol,
    network: settings.data?.network ?? NETWORK,
    rpcUrl: settings.data?.rpcUrl ?? RPC_URL,
    ref: posRef,
  });

  return (
    <li>
      <Link
        href={`/positions/${posRef.id}`}
        className="block py-6 transition-colors hover:bg-white/[0.02]"
      >
        {summary.data ? (
          <div className="grid grid-cols-12 items-baseline gap-4">
            <div className="col-span-4">
              <div className="flex items-baseline gap-3">
                <div className="t-h2">
                  {tokenSymbol(summary.data.tokenA.mint)}
                  <span className="text-[var(--color-text-muted)]"> / </span>
                  {tokenSymbol(summary.data.tokenB.mint)}
                </div>
                {activeTaskId ? (
                  <span className="inline-flex items-center gap-1 t-eyebrow text-[var(--color-positive)]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-positive)] pulse-soft" />
                    auto-exit set
                  </span>
                ) : null}
              </div>
              <div className="mt-1 t-eyebrow text-[var(--color-text-dim)]">
                <span
                  className={
                    posRef.protocol === "meteora"
                      ? "text-[var(--color-accent-bright)]"
                      : ""
                  }
                >
                  {PROTOCOL_LABELS[posRef.protocol as ProtocolName] ??
                    posRef.protocol}
                </span>{" "}
                · {posRef.label.split(" ").slice(-1)[0]}
              </div>
            </div>
            <div className="col-span-3">
              <div className="t-eyebrow text-[var(--color-text-muted)]">
                Price
              </div>
              <div className="mt-1 t-num text-[var(--color-text)]">
                {formatPrice(summary.data.currentPrice, 4)}
              </div>
            </div>
            <div className="col-span-3">
              <div className="t-eyebrow text-[var(--color-text-muted)]">
                Range
              </div>
              <div className="mt-1 t-num text-[var(--color-text)]">
                {formatPrice(summary.data.range.min, 2)} –{" "}
                {formatPrice(summary.data.range.max, 2)}
              </div>
              <div
                className={`mt-1 t-eyebrow ${
                  summary.data.isInRange
                    ? "text-[var(--color-positive)]"
                    : "text-[var(--color-warning)]"
                }`}
              >
                {formatRangeStatus(summary.data.isInRange)}
              </div>
            </div>
            <div className="col-span-2 text-right">
              <div className="t-eyebrow text-[var(--color-text-muted)]">
                Holdings
              </div>
              <div className="mt-1 t-num text-[var(--color-text)]">
                {formatTokenAmount(
                  summary.data.liquidity.tokenA,
                  summary.data.tokenA.decimals,
                  4,
                )}{" "}
                {tokenSymbol(summary.data.tokenA.mint)}
              </div>
              <div className="t-num text-[var(--color-text-muted)]">
                {formatTokenAmount(
                  summary.data.liquidity.tokenB,
                  summary.data.tokenB.decimals,
                  4,
                )}{" "}
                {tokenSymbol(summary.data.tokenB.mint)}
              </div>
            </div>
          </div>
        ) : summary.error ? (
          <p className="t-small text-[var(--color-danger)]">
            {summary.error.message}
          </p>
        ) : (
          <p className="t-small text-[var(--color-text-dim)]">Loading…</p>
        )}
      </Link>
    </li>
  );
}

// ============================================================================
// Empty owned list — el wallet existe pero no hay posiciones que cerrar
// ============================================================================

function EmptyOwnedList({
  owner,
  refresh,
}: {
  owner: string;
  refresh: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(owner);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="hairline-t pt-10">
      <div className="t-eyebrow text-[var(--color-text-muted)]">Empty</div>
      <h2 className="mt-3 t-h2">No LP positions in this wallet yet.</h2>
      <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
        The bot can only close positions whose NFT this address holds. There
        are two ways to put one here.
      </p>

      {/* Address block — el usuario lo necesita para ambas rutas */}
      <div className="mt-8 hairline-t hairline-b py-5">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          Bot wallet address
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <span className="t-num break-all text-[var(--color-text)]">
            {owner}
          </span>
          <button
            type="button"
            onClick={copy}
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>

      <ol className="mt-8 divide-y divide-[var(--color-hairline)]">
        <Path
          n="01"
          title="Open new positions from the bot account"
          body="Import the bot's secret into Phantom or Backpack as a new account (Settings → Add wallet → Import private key). Switch to it, then open an LP on Orca normally. The position NFT will be owned by this same address and will appear here on refresh."
        />
        <Path
          n="02"
          title="Transfer an existing position NFT"
          body="From any account that currently owns a Whirlpool position, send the position NFT to the address above. Ownership moves to the bot wallet and the position becomes closable from here. Don't forget to leave the bot wallet enough SOL for close + swap fees."
        />
      </ol>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Button variant="secondary" onClick={refresh}>
          Refresh
        </Button>
        <a
          href={`https://www.orca.so/?network=${NETWORK}`}
          target="_blank"
          rel="noopener noreferrer"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          open orca ↗
        </a>
        <Link
          href="/docs/getting-started"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          → Step-by-step guide
        </Link>
      </div>
    </section>
  );
}

function Path({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="grid grid-cols-12 gap-4 py-6 first:pt-0 md:gap-6">
      <div className="col-span-12 md:col-span-1">
        <span className="t-num text-[var(--color-accent-bright)]">{n}</span>
      </div>
      <div className="col-span-12 md:col-span-4">
        <h3 className="t-h2 text-[var(--color-text)]">{title}</h3>
      </div>
      <div className="col-span-12 md:col-span-7">
        <p className="t-body text-[var(--color-text-muted)]">{body}</p>
      </div>
    </li>
  );
}
