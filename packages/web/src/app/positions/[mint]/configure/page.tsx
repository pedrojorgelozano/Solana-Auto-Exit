"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardLabel, FieldError } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { NETWORK, PROTOCOL, RPC_URL } from "@/lib/constants";
import {
  formatPrice,
  formatTokenAmount,
  truncateAddress,
} from "@/lib/format";

type Direction = "above" | "below";
type ExitChoice = "none" | "A" | "B";

export default function ConfigurePage() {
  const params = useParams<{ mint: string }>();
  const router = useRouter();
  const mint = params.mint;

  const walletStatus = trpc.wallet.status.useQuery();
  const owner = walletStatus.data?.address;

  const list = trpc.positions.listOwned.useQuery(
    {
      protocol: PROTOCOL,
      network: NETWORK,
      rpcUrl: RPC_URL,
      owner: owner ?? "",
    },
    { enabled: !!owner && walletStatus.data?.unlocked === true },
  );

  const posRef = useMemo(
    () => list.data?.find((r) => r.id === mint),
    [list.data, mint],
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <PageHeader
        title="Configure auto-exit"
        description="Set the trigger and (optionally) the exit token. Dry-run is on by default."
        back={{ href: "/positions", label: "Positions" }}
      />

      {walletStatus.isLoading || list.isLoading ? (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
        </Card>
      ) : !walletStatus.data?.hasVault ? (
        <Card>
          <CardLabel>No vault</CardLabel>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Create your vault first.
          </p>
          <div className="mt-4">
            <Link href="/wallet">
              <Button>Go to Wallet →</Button>
            </Link>
          </div>
        </Card>
      ) : !walletStatus.data.unlocked ? (
        <Card>
          <CardLabel>Vault is locked</CardLabel>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Unlock your vault before creating a task.
          </p>
          <div className="mt-4">
            <Link href="/wallet">
              <Button>Unlock vault →</Button>
            </Link>
          </div>
        </Card>
      ) : list.error ? (
        <Card variant="danger">
          <p className="text-sm text-[var(--color-danger)]">
            {list.error.message}
          </p>
        </Card>
      ) : !posRef ? (
        <Card variant="danger">
          <p className="text-sm text-[var(--color-danger)]">
            Position{" "}
            <code className="text-[var(--color-text)]">
              {truncateAddress(mint, 6, 6)}
            </code>{" "}
            is not owned by your bot wallet. Make sure the address is correct
            and you opened the position with this wallet.
          </p>
        </Card>
      ) : (
        <ConfigureForm mint={mint} posRef={posRef} router={router} />
      )}
    </main>
  );
}

// ============================================================================
// Form
// ============================================================================

interface PositionRef {
  protocol: string;
  id: string;
  label: string;
  poolId: string;
}

function ConfigureForm({
  mint,
  posRef,
  router,
}: {
  mint: string;
  posRef: PositionRef;
  router: ReturnType<typeof useRouter>;
}) {
  const summary = trpc.positions.getSummary.useQuery({
    protocol: PROTOCOL,
    network: NETWORK,
    rpcUrl: RPC_URL,
    ref: posRef,
  });
  const [direction, setDirection] = useState<Direction>("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [slippageBps, setSlippageBps] = useState("100");
  const [pollMs, setPollMs] = useState("30000");
  const [dryRun, setDryRun] = useState(true);
  const [exitChoice, setExitChoice] = useState<ExitChoice>("none");
  const [exitSwapSlippageBps, setExitSwapSlippageBps] = useState("100");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.tasks.create.useMutation();
  const start = trpc.tasks.start.useMutation();
  const busy = create.isPending || start.isPending;

  const currentPrice = summary.data?.currentPrice;
  const tokenA = summary.data?.tokenA;
  const tokenB = summary.data?.tokenB;
  const liquidity = summary.data?.liquidity;

  const targetNum = Number(targetPrice);
  const targetValid = Number.isFinite(targetNum) && targetNum > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!summary.data || !tokenA || !tokenB) {
      setError("Position summary not loaded yet.");
      return;
    }
    if (!targetValid) {
      setError("Target price must be a positive number.");
      return;
    }
    const slipNum = Number(slippageBps);
    const pollNum = Number(pollMs);
    const exitSlipNum = Number(exitSwapSlippageBps);
    if (!Number.isInteger(slipNum) || slipNum < 0 || slipNum > 10000) {
      setError("Slippage (bps) must be an integer between 0 and 10000.");
      return;
    }
    if (!Number.isInteger(pollNum) || pollNum < 1000) {
      setError("Poll interval must be ≥ 1000 ms.");
      return;
    }
    if (
      exitChoice !== "none" &&
      (!Number.isInteger(exitSlipNum) ||
        exitSlipNum < 0 ||
        exitSlipNum > 10000)
    ) {
      setError("Exit slippage (bps) must be an integer between 0 and 10000.");
      return;
    }

    const exitTokenMint =
      exitChoice === "A"
        ? tokenA.mint
        : exitChoice === "B"
          ? tokenB.mint
          : undefined;

    try {
      const task = await create.mutateAsync({
        protocol: PROTOCOL,
        network: NETWORK,
        rpcUrl: RPC_URL,
        positionId: mint,
        protocolConfig: {
          positionMint: mint,
          decimalsA: tokenA.decimals,
          decimalsB: tokenB.decimals,
        },
        targetPrice: targetNum,
        direction,
        slippageBps: slipNum,
        pollMs: pollNum,
        dryRun,
        ...(exitTokenMint ? { exitTokenMint } : {}),
        exitSwapSlippageBps: exitSlipNum,
      });
      await start.mutateAsync({ id: task.id });
      router.push(`/tasks/${task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      {/* Context card */}
      <Card>
        <CardLabel>{posRef.label}</CardLabel>
        <div className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
          pool {truncateAddress(posRef.poolId, 6, 6)} · mint{" "}
          {truncateAddress(posRef.id, 6, 6)}
        </div>
        {summary.isLoading ? (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">
            Loading current price…
          </p>
        ) : summary.error ? (
          <p className="mt-4 text-sm text-[var(--color-danger)]">
            {summary.error.message}
          </p>
        ) : summary.data ? (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Mini label="Current price">
              {formatPrice(summary.data.currentPrice, 6)}
            </Mini>
            <Mini label="Range">
              {formatPrice(summary.data.range.min, 4)} →{" "}
              {formatPrice(summary.data.range.max, 4)}
            </Mini>
            <Mini label="In range">
              {summary.data.isInRange ? "yes" : "no"}
            </Mini>
          </div>
        ) : null}
      </Card>

      {/* Form */}
      <Card>
        <form onSubmit={submit} className="space-y-6">
          {/* Trigger */}
          <div>
            <Label>Trigger direction</Label>
            <div className="flex gap-2">
              <Toggle
                label="Above (take-profit)"
                active={direction === "above"}
                onClick={() => setDirection("above")}
              />
              <Toggle
                label="Below (stop)"
                active={direction === "below"}
                onClick={() => setDirection("below")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label
                htmlFor="target"
                hint={
                  currentPrice !== undefined
                    ? `current ${formatPrice(currentPrice, 6)}`
                    : undefined
                }
              >
                Target price
              </Label>
              <Input
                id="target"
                type="number"
                step="any"
                min="0"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="poll" hint="ms (≥ 1000)">
                Poll interval
              </Label>
              <Input
                id="poll"
                type="number"
                min={1000}
                step={1000}
                value={pollMs}
                onChange={(e) => setPollMs(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="slippage" hint="bps · 100 = 1%">
              Close slippage
            </Label>
            <Input
              id="slippage"
              type="number"
              min={0}
              max={10000}
              step={10}
              value={slippageBps}
              onChange={(e) => setSlippageBps(e.target.value)}
              required
            />
          </div>

          {/* Exit token */}
          <div>
            <Label>Exit token (optional)</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Toggle
                label="Keep both (no swap)"
                active={exitChoice === "none"}
                onClick={() => setExitChoice("none")}
              />
              <Toggle
                label={
                  tokenA
                    ? `Swap to ${truncateAddress(tokenA.mint, 4, 4)}`
                    : "Token A"
                }
                active={exitChoice === "A"}
                onClick={() => setExitChoice("A")}
                disabled={!tokenA}
              />
              <Toggle
                label={
                  tokenB
                    ? `Swap to ${truncateAddress(tokenB.mint, 4, 4)}`
                    : "Token B"
                }
                active={exitChoice === "B"}
                onClick={() => setExitChoice("B")}
                disabled={!tokenB}
              />
            </div>
          </div>

          {exitChoice !== "none" ? (
            <div>
              <Label htmlFor="exit-slip" hint="bps">
                Exit swap slippage
              </Label>
              <Input
                id="exit-slip"
                type="number"
                min={0}
                max={10000}
                step={10}
                value={exitSwapSlippageBps}
                onChange={(e) => setExitSwapSlippageBps(e.target.value)}
                required
              />
            </div>
          ) : null}

          {/* Dry run */}
          <div className="flex items-start gap-3 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-4">
            <input
              id="dry"
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <div className="flex-1 text-sm">
              <label htmlFor="dry" className="cursor-pointer font-medium">
                Dry run (no transactions sent)
              </label>
              <p className="text-xs text-[var(--color-text-muted)]">
                When the trigger fires, the bot logs the quotes and stops
                without signing or sending anything. Recommended on first
                run.
              </p>
            </div>
          </div>

          {/* Live preview */}
          <PreviewBox
            direction={direction}
            target={targetValid ? targetNum : null}
            currentPrice={currentPrice}
            tokenA={tokenA}
            tokenB={tokenB}
            liquidity={liquidity}
            exitChoice={exitChoice}
            dryRun={dryRun}
          />

          {error ? <FieldError>{error}</FieldError> : null}

          <div className="flex items-center justify-end gap-3">
            <Button type="submit" disabled={busy || !summary.data}>
              {busy
                ? "Starting…"
                : dryRun
                  ? "Start watching (dry-run) →"
                  : "Start watching →"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ============================================================================
// Small UI helpers
// ============================================================================

function Mini({
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
      <div className="mt-0.5 font-mono text-sm">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-40 ${
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]"
          : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function PreviewBox({
  direction,
  target,
  currentPrice,
  tokenA,
  tokenB,
  liquidity,
  exitChoice,
  dryRun,
}: {
  direction: Direction;
  target: number | null;
  currentPrice: number | undefined;
  tokenA: { mint: string; decimals: number } | undefined;
  tokenB: { mint: string; decimals: number } | undefined;
  liquidity: { tokenA: string; tokenB: string } | undefined;
  exitChoice: ExitChoice;
  dryRun: boolean;
}) {
  if (
    target === null ||
    currentPrice === undefined ||
    !tokenA ||
    !tokenB ||
    !liquidity
  ) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-text-muted)]">
        Fill in target price to see the preview.
      </div>
    );
  }

  const distancePct = ((target - currentPrice) / currentPrice) * 100;
  const triggerLabel =
    direction === "above" ? "price ≥ target" : "price ≤ target";
  const willTriggerNow =
    direction === "above" ? currentPrice >= target : currentPrice <= target;

  const closeAmountA = formatTokenAmount(liquidity.tokenA, tokenA.decimals);
  const closeAmountB = formatTokenAmount(liquidity.tokenB, tokenB.decimals);

  let swapLine: string | null = null;
  if (exitChoice === "A") {
    // Swap tokenB → tokenA
    swapLine = `then swap the ~${closeAmountB} ${truncateAddress(
      tokenB.mint,
      4,
      4,
    )} to ${truncateAddress(tokenA.mint, 4, 4)} (within slippage).`;
  } else if (exitChoice === "B") {
    swapLine = `then swap the ~${closeAmountA} ${truncateAddress(
      tokenA.mint,
      4,
      4,
    )} to ${truncateAddress(tokenB.mint, 4, 4)} (within slippage).`;
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm">
      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        Preview
      </div>
      <p className="mt-2">
        When <span className="font-medium">{triggerLabel}</span> (target{" "}
        <span className="font-mono">{formatPrice(target, 6)}</span>, current{" "}
        <span className="font-mono">{formatPrice(currentPrice, 6)}</span> →{" "}
        <span className="font-mono">
          {distancePct >= 0 ? "+" : ""}
          {distancePct.toFixed(2)}%
        </span>
        ), the bot will close the position and recover approximately{" "}
        <span className="font-mono">{closeAmountA}</span>{" "}
        {truncateAddress(tokenA.mint, 4, 4)} +{" "}
        <span className="font-mono">{closeAmountB}</span>{" "}
        {truncateAddress(tokenB.mint, 4, 4)}.
      </p>
      {swapLine ? <p className="mt-2">{swapLine}</p> : null}
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        {dryRun
          ? "Dry-run is ON: no transactions will be sent."
          : "Dry-run is OFF: real transactions will be signed and broadcast."}
        {willTriggerNow
          ? " · Trigger is already true; the watcher will fire on the first tick."
          : ""}
      </p>
    </div>
  );
}
