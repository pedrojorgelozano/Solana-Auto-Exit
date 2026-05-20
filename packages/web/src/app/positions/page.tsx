"use client";

import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { NETWORK, PROTOCOL, RPC_URL } from "@/lib/constants";
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
      <div className="t-eyebrow text-[var(--color-warning)]">No vault</div>
      <h2 className="mt-3 t-h2">Set up your bot wallet first.</h2>
      <p className="mt-3 max-w-md t-body text-[var(--color-text-muted)]">
        Without a vault the server has no key to read positions or sign closes.
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
      <div className="t-eyebrow text-[var(--color-text-muted)]">Vault is locked</div>
      <h2 className="mt-3 t-h2">Unlock to list your positions.</h2>
      <div className="mt-6">
        <Link href="/wallet">
          <Button>Unlock vault →</Button>
        </Link>
      </div>
    </section>
  );
}

function OwnedList({ owner }: { owner: string }) {
  const list = trpc.positions.listOwned.useQuery({
    protocol: PROTOCOL,
    network: NETWORK,
    rpcUrl: RPC_URL,
    owner,
  });

  if (list.isLoading) {
    return (
      <p className="t-small text-[var(--color-text-muted)]">
        Querying the chain for {PROTOCOL} positions of this wallet…
      </p>
    );
  }
  if (list.error) {
    return (
      <div>
        <p className="t-small text-[var(--color-danger)]">{list.error.message}</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => list.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }
  if (!list.data || list.data.length === 0) {
    return (
      <section className="hairline-t pt-10">
        <div className="t-eyebrow text-[var(--color-text-muted)]">Empty</div>
        <h2 className="mt-3 t-h2">No positions in this wallet.</h2>
        <p className="mt-3 max-w-md t-body text-[var(--color-text-muted)]">
          Open one in the protocol&apos;s UI ({PROTOCOL} on {NETWORK}: custom
          range out-of-range, 0.1 SOL) and refresh.
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={() => list.refetch()}>
            Refresh
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between hairline-b pb-4">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {list.data.length} {list.data.length === 1 ? "position" : "positions"}
        </div>
        <button
          onClick={() => list.refetch()}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          refresh
        </button>
      </div>
      <ul className="divide-y divide-[var(--color-hairline)]">
        {list.data.map((ref) => (
          <PositionRow key={ref.id} posRef={ref} />
        ))}
      </ul>
    </div>
  );
}

function PositionRow({ posRef }: { posRef: PositionRef }) {
  const summary = trpc.positions.getSummary.useQuery({
    protocol: PROTOCOL,
    network: NETWORK,
    rpcUrl: RPC_URL,
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
              <div className="t-h2">
                {tokenSymbol(summary.data.tokenA.mint)}
                <span className="text-[var(--color-text-muted)]"> / </span>
                {tokenSymbol(summary.data.tokenB.mint)}
              </div>
              <div className="mt-1 t-eyebrow text-[var(--color-text-dim)]">
                {posRef.protocol} · {posRef.label.split(" ").slice(-1)[0]}
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
