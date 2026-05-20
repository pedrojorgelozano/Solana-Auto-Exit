"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PositionCard } from "@/components/PositionCard";
import { Card, CardLabel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { NETWORK, PROTOCOL, RPC_URL } from "@/lib/constants";

export default function PositionsPage() {
  const status = trpc.wallet.status.useQuery();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <PageHeader
        title="Positions"
        description="Liquidity positions owned by your bot wallet. Pick one to configure an auto-exit."
        back={{ href: "/", label: "Home" }}
      />
      <Body status={status.data} loading={status.isLoading} error={status.error?.message ?? null} />
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
    return (
      <Card>
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      </Card>
    );
  }
  if (error) {
    return (
      <Card variant="danger">
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      </Card>
    );
  }
  if (!status?.hasVault) {
    return <NoVaultState />;
  }
  if (!status.unlocked) {
    return <LockedState address={status.address} />;
  }
  return <OwnedList owner={status.address!} />;
}

function NoVaultState() {
  return (
    <Card>
      <CardLabel>No vault yet</CardLabel>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Create your encrypted wallet vault before listing positions.
      </p>
      <div className="mt-4">
        <Link href="/wallet">
          <Button variant="primary">Go to Wallet →</Button>
        </Link>
      </div>
    </Card>
  );
}

function LockedState({ address }: { address: string | null }) {
  return (
    <Card>
      <CardLabel>Vault is locked</CardLabel>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Unlock your vault to list positions owned by{" "}
        <code className="text-[var(--color-text)]">
          {address ?? "(unknown)"}
        </code>
        .
      </p>
      <div className="mt-4">
        <Link href="/wallet">
          <Button variant="primary">Unlock vault →</Button>
        </Link>
      </div>
    </Card>
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
      <Card>
        <p className="text-sm text-[var(--color-text-muted)]">
          Querying RPC for {PROTOCOL} positions of{" "}
          <code className="text-[var(--color-text)]">{owner}</code>…
        </p>
      </Card>
    );
  }

  if (list.error) {
    return (
      <Card variant="danger">
        <p className="text-sm text-[var(--color-danger)]">{list.error.message}</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => list.refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!list.data || list.data.length === 0) {
    return (
      <Card>
        <CardLabel>No positions found</CardLabel>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          The bot wallet ({owner}) has no open {PROTOCOL} positions on{" "}
          {NETWORK}. Open one in the protocol&apos;s UI (Orca on devnet:
          custom range out-of-range, ~0.1 SOL) and refresh.
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => list.refetch()}>
            Refresh
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          {list.data.length} position{list.data.length === 1 ? "" : "s"} ·{" "}
          {PROTOCOL} · {NETWORK}
        </p>
        <Button variant="ghost" onClick={() => list.refetch()}>
          Refresh
        </Button>
      </div>

      {list.data.map((posRef) => (
        <PositionCard key={posRef.id} posRef={posRef} />
      ))}
    </div>
  );
}
