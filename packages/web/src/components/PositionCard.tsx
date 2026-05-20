"use client";

import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { NETWORK, PROTOCOL, RPC_URL } from "@/lib/constants";
import { formatPrice, formatTokenAmount, truncateAddress } from "@/lib/format";

interface PositionRef {
  protocol: string;
  id: string;
  label: string;
  poolId: string;
}

export function PositionCard({ posRef }: { posRef: PositionRef }) {
  const summary = trpc.positions.getSummary.useQuery({
    protocol: PROTOCOL,
    network: NETWORK,
    rpcUrl: RPC_URL,
    ref: posRef,
  });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardLabel>{posRef.label}</CardLabel>
          <div className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
            pool {truncateAddress(posRef.poolId, 6, 6)} · mint{" "}
            {truncateAddress(posRef.id, 6, 6)}
          </div>
        </div>
      </div>

      {summary.isLoading ? (
        <div className="mt-6 text-sm text-[var(--color-text-muted)]">
          Loading summary…
        </div>
      ) : summary.error ? (
        <div className="mt-6 text-sm text-[var(--color-danger)]">
          {summary.error.message}
        </div>
      ) : !summary.data ? null : (
        <SummaryView data={summary.data} mintId={posRef.id} />
      )}

      <div className="mt-6 flex items-center justify-end">
        <Link href={`/positions/${posRef.id}/configure`}>
          <Button variant="primary">Configure auto-exit →</Button>
        </Link>
      </div>
    </Card>
  );
}

function SummaryView({
  data,
  mintId,
}: {
  data: {
    currentPrice: number;
    range: { min: number; max: number };
    isInRange: boolean;
    tokenA: { mint: string; decimals: number };
    tokenB: { mint: string; decimals: number };
    liquidity: { tokenA: string; tokenB: string };
    feesPending?: { tokenA: string; tokenB: string };
  };
  mintId: string;
}) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <Field label="Current price">{formatPrice(data.currentPrice, 6)}</Field>
      <Field label="In range">
        {data.isInRange ? (
          <span className="text-[var(--color-success)]">yes</span>
        ) : (
          <span className="text-[var(--color-warning)]">no</span>
        )}
      </Field>
      <Field label="Range">
        {formatPrice(data.range.min, 4)} → {formatPrice(data.range.max, 4)}
      </Field>
      <Field label="Decimals A / B">
        {data.tokenA.decimals} / {data.tokenB.decimals}
      </Field>
      <Field label="Liquidity A">
        {formatTokenAmount(data.liquidity.tokenA, data.tokenA.decimals)}
      </Field>
      <Field label="Liquidity B">
        {formatTokenAmount(data.liquidity.tokenB, data.tokenB.decimals)}
      </Field>
      {data.feesPending ? (
        <>
          <Field label="Fees pending A">
            {formatTokenAmount(data.feesPending.tokenA, data.tokenA.decimals)}
          </Field>
          <Field label="Fees pending B">
            {formatTokenAmount(data.feesPending.tokenB, data.tokenB.decimals)}
          </Field>
        </>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[var(--color-text)]">{children}</div>
    </div>
  );
}
