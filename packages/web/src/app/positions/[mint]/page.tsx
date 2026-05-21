"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { FieldError } from "@/components/ui/Card";
import { trpc } from "@/lib/trpc";
import { NETWORK, PROTOCOL, RPC_URL } from "@/lib/constants";
import {
  formatDistance,
  formatNearestDistance,
  formatPrice,
  formatRangeStatus,
  formatTokenAmount,
  truncateAddress,
} from "@/lib/format";
import { statusView, TONE_CLASSES, type BackendStatus } from "@/lib/status";
import { tokenSymbol } from "@/lib/tokens";

type Direction = "above" | "below";
type ExitChoice = "none" | "A" | "B";
type PollPreset = 10_000 | 30_000 | 60_000 | 300_000;
type SlippageBps = 50 | 100 | 200 | 500;
type PositionSummary = inferRouterOutputs<AppRouter>["positions"]["getSummary"];

export default function PositionPage() {
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
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow="Position"
        title="Configure the exit."
        back={{ href: "/positions", label: "Positions" }}
      />

      {walletStatus.isLoading || list.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">Loading…</p>
      ) : !walletStatus.data?.hasVault || !walletStatus.data.unlocked ? (
        <NeedWallet hasVault={walletStatus.data?.hasVault ?? false} />
      ) : list.error ? (
        <p className="t-small text-[var(--color-danger)]">{list.error.message}</p>
      ) : !posRef ? (
        <p className="t-small text-[var(--color-danger)]">
          Position{" "}
          <span className="t-num text-[var(--color-text)]">
            {truncateAddress(mint, 6, 6)}
          </span>{" "}
          is not in this wallet.
        </p>
      ) : (
        <Editor mint={mint} posRef={posRef} router={router} />
      )}
    </main>
  );
}

function NeedWallet({ hasVault }: { hasVault: boolean }) {
  return (
    <section className="hairline-t pt-10">
      <div className="t-eyebrow text-[var(--color-warning)]">
        {hasVault ? "Wallet is locked" : "No wallet"}
      </div>
      <h2 className="mt-3 t-h2">
        {hasVault ? "Unlock to configure." : "Set up your wallet first."}
      </h2>
      <div className="mt-6">
        <Link href="/wallet">
          <Button>{hasVault ? "Unlock wallet →" : "Go to wallet →"}</Button>
        </Link>
      </div>
    </section>
  );
}

// ============================================================================
// Editor
// ============================================================================

interface PositionRef {
  protocol: string;
  id: string;
  label: string;
  poolId: string;
}

function Editor({
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

  // Listamos tasks y filtramos por positionId para detectar si esta posición
  // ya tiene un auto-exit activo. Una posición = un auto-exit activo a la vez.
  const tasks = trpc.tasks.list.useQuery(undefined, { refetchInterval: 5_000 });
  const activeTask = tasks.data?.find(
    (t) =>
      t.positionId === mint &&
      ["idle", "armed", "triggered", "closing", "paused"].includes(t.status),
  );

  return (
    <div className="space-y-12">
      <PositionRecap
        posRef={posRef}
        summary={summary.data}
        loading={summary.isLoading}
        error={summary.error?.message ?? null}
      />

      {activeTask ? (
        <ExistingWatcher task={activeTask} />
      ) : summary.data ? (
        <ConfigureForm mint={mint} summary={summary.data} router={router} />
      ) : null}
    </div>
  );
}

// ============================================================================
// Existing watcher panel — sustituye al form cuando ya hay un auto-exit activo
// ============================================================================

function ExistingWatcher({
  task,
}: {
  task: inferRouterOutputs<AppRouter>["tasks"]["list"][number];
}) {
  const view = statusView(task.status as BackendStatus);
  const tone = TONE_CLASSES[view.tone];
  const nearest = formatNearestDistance(
    task.runtime.lastPrice,
    task.takeProfitPrice,
    task.stopLossPrice,
  );

  const utils = trpc.useUtils();
  const del = trpc.tasks.delete.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="hairline-t pt-8">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot} ${
            view.pulsing ? "pulse-soft" : ""
          }`}
        />
        <span className={`t-eyebrow ${tone.text}`}>{view.label}</span>
        {task.dryRun ? (
          <span className="t-eyebrow text-[var(--color-warning)]">
            · simulation
          </span>
        ) : null}
      </div>

      <h2 className="mt-3 t-h2">
        This position already has an auto-exit.
      </h2>
      <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
        One auto-exit per position. Open it to see its live status, pause
        or stop it. If you want different settings, delete the current one
        and set up a new one.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <Field label="Take profit">
          <span className="t-num">
            {task.takeProfitPrice !== null
              ? `≥ ${formatPrice(task.takeProfitPrice, 6)}`
              : "—"}
          </span>
        </Field>
        <Field label="Stop loss">
          <span className="t-num">
            {task.stopLossPrice !== null
              ? `≤ ${formatPrice(task.stopLossPrice, 6)}`
              : "—"}
          </span>
        </Field>
        <Field label="Last price">
          <span className="t-num">
            {task.runtime.lastPrice !== null
              ? formatPrice(task.runtime.lastPrice, 6)
              : "—"}
          </span>
        </Field>
        <Field label="Nearest">
          <span
            className={`t-num ${
              nearest.reached
                ? "text-[var(--color-warning)]"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            {nearest.text}
            {nearest.kind ? ` ${nearest.kind === "tp" ? "TP" : "SL"}` : ""}
          </span>
        </Field>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-end gap-3 hairline-t pt-6">
        {confirming ? (
          <>
            <span className="t-small text-[var(--color-danger)]">
              Delete the current auto-exit?
            </span>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => del.mutate({ id: task.id })}
              disabled={del.isPending}
            >
              {del.isPending ? "Deleting…" : "Yes, delete"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              Delete auto-exit
            </Button>
            <Link href={`/tasks/${task.id}`}>
              <Button>Open auto-exit →</Button>
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Recap — la posición vista como "ficha de prensa"
// ============================================================================

function PositionRecap({
  posRef,
  summary,
  loading,
  error,
}: {
  posRef: PositionRef;
  summary: PositionSummary | undefined;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <p className="t-small text-[var(--color-text-muted)]">
        Loading position state…
      </p>
    );
  }
  if (error) {
    return <p className="t-small text-[var(--color-danger)]">{error}</p>;
  }
  if (!summary) return null;

  const symA = tokenSymbol(summary.tokenA.mint);
  const symB = tokenSymbol(summary.tokenB.mint);

  return (
    <section>
      <div className="t-eyebrow text-[var(--color-text-muted)]">
        {posRef.protocol} · {symA} / {symB}
      </div>
      <h2 className="mt-2 t-h2">
        1 {symA} = <span className="t-num">{formatPrice(summary.currentPrice, 6)}</span>{" "}
        {symB}
      </h2>

      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 hairline-t pt-8 md:grid-cols-4">
        <Field label="Range">
          <span className="t-num">
            {formatPrice(summary.range.min, 2)} – {formatPrice(summary.range.max, 2)}
          </span>
          <div
            className={`mt-1 t-eyebrow ${
              summary.isInRange
                ? "text-[var(--color-positive)]"
                : "text-[var(--color-warning)]"
            }`}
          >
            {formatRangeStatus(summary.isInRange)}
          </div>
        </Field>
        <Field label={`Holdings ${symA}`}>
          <span className="t-num">
            {formatTokenAmount(summary.liquidity.tokenA, summary.tokenA.decimals, 6)}
          </span>
        </Field>
        <Field label={`Holdings ${symB}`}>
          <span className="t-num">
            {formatTokenAmount(summary.liquidity.tokenB, summary.tokenB.decimals, 6)}
          </span>
        </Field>
        <Field label="Fees pending">
          {summary.feesPending ? (
            <div className="t-num text-[var(--color-text-muted)]">
              <div>
                {formatTokenAmount(summary.feesPending.tokenA, summary.tokenA.decimals, 6)} {symA}
              </div>
              <div>
                {formatTokenAmount(summary.feesPending.tokenB, summary.tokenB.decimals, 6)} {symB}
              </div>
            </div>
          ) : (
            <span className="t-num text-[var(--color-text-muted)]">—</span>
          )}
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-eyebrow text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-2 text-[var(--color-text)]">{children}</div>
    </div>
  );
}

// ============================================================================
// Form
// ============================================================================

const POLL_PRESETS: { ms: PollPreset; label: string }[] = [
  { ms: 10_000, label: "10s" },
  { ms: 30_000, label: "30s" },
  { ms: 60_000, label: "1 min" },
  { ms: 300_000, label: "5 min" },
];

const SLIPPAGE_PRESETS: { bps: SlippageBps; label: string }[] = [
  { bps: 50, label: "0.5%" },
  { bps: 100, label: "1%" },
  { bps: 200, label: "2%" },
  { bps: 500, label: "5%" },
];

function ConfigureForm({
  mint,
  summary,
  router,
}: {
  mint: string;
  summary: PositionSummary;
  router: ReturnType<typeof useRouter>;
}) {
  const { tokenA, tokenB, currentPrice } = summary;
  const symA = tokenSymbol(tokenA.mint);
  const symB = tokenSymbol(tokenB.mint);

  // Triggers independientes: cada uno tiene su toggle + su precio.
  const [tpEnabled, setTpEnabled] = useState(true);
  const [tpPrice, setTpPrice] = useState("");
  const [slEnabled, setSlEnabled] = useState(false);
  const [slPrice, setSlPrice] = useState("");

  const [pollMs, setPollMs] = useState<PollPreset>(30_000);
  const [slippageBps, setSlippageBps] = useState<SlippageBps>(100);
  const [exitChoice, setExitChoice] = useState<ExitChoice>("none");
  const [exitSlippageBps, setExitSlippageBps] = useState<SlippageBps>(100);
  const [simulation, setSimulation] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = trpc.tasks.create.useMutation();
  const start = trpc.tasks.start.useMutation();
  const busy = create.isPending || start.isPending;

  const applyTpPreset = (pct: number) => {
    const next = currentPrice * (1 + pct / 100);
    setTpPrice(next.toFixed(6).replace(/\.?0+$/, ""));
    setTpEnabled(true);
  };
  const applySlPreset = (pct: number) => {
    const next = currentPrice * (1 - pct / 100);
    setSlPrice(next.toFixed(6).replace(/\.?0+$/, ""));
    setSlEnabled(true);
  };

  const tpNum = Number(tpPrice);
  const slNum = Number(slPrice);
  const tpValid = tpEnabled && Number.isFinite(tpNum) && tpNum > 0;
  const slValid = slEnabled && Number.isFinite(slNum) && slNum > 0;
  const atLeastOne = tpValid || slValid;

  const tpDistance = tpValid
    ? formatDistance(currentPrice, tpNum, "above")
    : null;
  const slDistance = slValid
    ? formatDistance(currentPrice, slNum, "below")
    : null;

  const exitMint =
    exitChoice === "A" ? tokenA.mint : exitChoice === "B" ? tokenB.mint : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!atLeastOne) {
      setError("Enable take-profit, stop-loss, or both. At least one is required.");
      return;
    }
    if (tpValid && slValid && tpNum <= slNum) {
      setError("Take-profit must be greater than stop-loss (TP > SL).");
      return;
    }
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
        takeProfitPrice: tpValid ? tpNum : null,
        stopLossPrice: slValid ? slNum : null,
        slippageBps,
        pollMs,
        dryRun: simulation,
        ...(exitMint ? { exitTokenMint: exitMint } : {}),
        exitSwapSlippageBps: exitSlippageBps,
      });
      await start.mutateAsync({ id: task.id });
      router.push(`/tasks/${task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-12">
      {/* === When to close === */}
      <fieldset className="hairline-t pt-8">
        <legend className="t-eyebrow mb-4">1 — When to close</legend>
        <p className="t-small text-[var(--color-text-muted)] max-w-lg">
          Enable take-profit, stop-loss, or both. The auto-exit closes when
          either price is hit (whichever happens first).
        </p>

        <div className="mt-8 space-y-8">
          <TriggerInput
            kind="tp"
            enabled={tpEnabled}
            setEnabled={setTpEnabled}
            price={tpPrice}
            setPrice={setTpPrice}
            currentPrice={currentPrice}
            symA={symA}
            symB={symB}
            distance={tpDistance}
            applyPreset={applyTpPreset}
          />
          <TriggerInput
            kind="sl"
            enabled={slEnabled}
            setEnabled={setSlEnabled}
            price={slPrice}
            setPrice={setSlPrice}
            currentPrice={currentPrice}
            symA={symA}
            symB={symB}
            distance={slDistance}
            applyPreset={applySlPreset}
          />
        </div>
      </fieldset>

      {/* === Output token === */}
      <fieldset className="hairline-t pt-8">
        <legend className="t-eyebrow mb-4">2 — What to do with the output</legend>
        <Segmented
          value={exitChoice}
          onChange={(v) => setExitChoice(v as ExitChoice)}
          options={[
            { value: "none", label: "Keep both tokens" },
            { value: "A", label: `Sell into ${symA}` },
            { value: "B", label: `Sell into ${symB}` },
          ]}
        />
        {exitChoice !== "none" ? (
          <p className="mt-4 max-w-lg t-small text-[var(--color-text-muted)]">
            After closing, the non-{exitChoice === "A" ? symA : symB} side is
            swapped on the same pool with up to{" "}
            <span className="t-num text-[var(--color-text)]">
              {exitSlippageBps / 100}%
            </span>{" "}
            slippage tolerance.
          </p>
        ) : (
          <p className="mt-4 max-w-lg t-small text-[var(--color-text-muted)]">
            Both tokens are returned to your wallet as the position releases them.
          </p>
        )}
      </fieldset>

      {/* === Safety === */}
      <fieldset className="hairline-t pt-8">
        <legend className="t-eyebrow mb-4">3 — Safety</legend>

        <SimulationToggle value={simulation} onChange={setSimulation} />

        <div className="mt-8">
          <Label>Close slippage tolerance</Label>
          <Segmented
            value={String(slippageBps)}
            onChange={(v) => setSlippageBps(Number(v) as SlippageBps)}
            options={SLIPPAGE_PRESETS.map((p) => ({
              value: String(p.bps),
              label: p.label,
            }))}
          />
        </div>
      </fieldset>

      {/* === Advanced === */}
      <div className="hairline-t pt-6">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          {showAdvanced ? "− Hide" : "+ Show"} advanced settings
        </button>

        {showAdvanced ? (
          <div className="mt-6 space-y-6 fade-in">
            <div>
              <Label>Poll interval</Label>
              <Segmented
                value={String(pollMs)}
                onChange={(v) => setPollMs(Number(v) as PollPreset)}
                options={POLL_PRESETS.map((p) => ({
                  value: String(p.ms),
                  label: p.label,
                }))}
              />
              <p className="mt-2 t-small text-[var(--color-text-dim)]">
                How often the server reads the pool price.
              </p>
            </div>
            {exitChoice !== "none" ? (
              <div>
                <Label>Exit swap slippage</Label>
                <Segmented
                  value={String(exitSlippageBps)}
                  onChange={(v) => setExitSlippageBps(Number(v) as SlippageBps)}
                  options={SLIPPAGE_PRESETS.map((p) => ({
                    value: String(p.bps),
                    label: p.label,
                  }))}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      <div className="flex items-center justify-between hairline-t pt-8">
        <p className="t-small text-[var(--color-text-muted)]">
          {simulation
            ? "Simulation mode: no transactions will be sent."
            : "Real mode: transactions will be signed and broadcast."}
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? "Starting…" : simulation ? "Start (simulate)" : "Start watching"}
        </Button>
      </div>
    </form>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap border border-[var(--color-hairline)] rounded-[2px]">
      {options.map((opt, i) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 t-eyebrow transition-colors ${
              i > 0 ? "border-l border-[var(--color-hairline)]" : ""
            } ${
              active
                ? "bg-[var(--color-accent-dim)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function TriggerInput({
  kind,
  enabled,
  setEnabled,
  price,
  setPrice,
  currentPrice,
  symA,
  symB,
  distance,
  applyPreset,
}: {
  kind: "tp" | "sl";
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  price: string;
  setPrice: (v: string) => void;
  currentPrice: number;
  symA: string;
  symB: string;
  distance: ReturnType<typeof formatDistance> | null;
  applyPreset: (pct: number) => void;
}) {
  const label = kind === "tp" ? "Take profit" : "Stop loss";
  const verb = kind === "tp" ? "rises to" : "drops to";
  const presetSign = kind === "tp" ? "+" : "−";

  return (
    <div
      className={`border-l-2 pl-5 transition-opacity ${
        enabled ? "" : "opacity-40"
      } ${
        kind === "tp"
          ? "border-[var(--color-positive)]"
          : "border-[var(--color-warning)]"
      }`}
    >
      {/* Toggle row */}
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        className="flex items-center gap-3 text-left"
        aria-pressed={enabled}
      >
        <span
          className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors px-0.5 ${
            enabled
              ? kind === "tp"
                ? "border-[var(--color-positive)] bg-[var(--color-positive)]/30 justify-end"
                : "border-[var(--color-warning)] bg-[var(--color-warning)]/30 justify-end"
              : "border-[var(--color-hairline)] bg-transparent justify-start"
          }`}
        >
          <span
            className={`block h-3 w-3 rounded-full ${
              enabled
                ? kind === "tp"
                  ? "bg-[var(--color-positive)]"
                  : "bg-[var(--color-warning)]"
                : "bg-[var(--color-text-dim)]"
            }`}
          />
        </span>
        <span
          className={`t-eyebrow ${
            enabled
              ? kind === "tp"
                ? "text-[var(--color-positive)]"
                : "text-[var(--color-warning)]"
              : "text-[var(--color-text-muted)]"
          }`}
        >
          {label}
        </span>
        <span className="t-small text-[var(--color-text-muted)]">
          close when 1 {symA} {verb} a target price in {symB}
        </span>
      </button>

      {enabled ? (
        <div className="mt-4 fade-in">
          {/* Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-eyebrow text-[var(--color-text-dim)] mr-1">
              from current
            </span>
            {[5, 10, 25, 50].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => applyPreset(pct)}
                className="h-8 border border-[var(--color-hairline)] hover:border-[var(--color-text)] px-3 t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-[2px] transition-colors"
              >
                {presetSign}
                {pct}%
              </button>
            ))}
          </div>

          {/* Price input */}
          <div className="mt-4 max-w-sm">
            <Label
              htmlFor={`${kind}-price`}
              hint={`current ${formatPrice(currentPrice, 6)}`}
            >
              Target price ({symB} per {symA})
            </Label>
            <Input
              id={`${kind}-price`}
              type="number"
              step="any"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="t-num text-xl"
            />
            {distance && distance.pct !== null ? (
              <div
                className={`mt-2 t-eyebrow ${
                  distance.reached
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {distance.text}
                {distance.reached ? " · trigger already true" : " from current"}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SimulationToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={`flex items-start gap-4 p-4 border-l-2 transition-colors ${
        value
          ? "border-[var(--color-warning)] bg-[var(--color-warning-bg)]"
          : "border-[var(--color-danger)] bg-[var(--color-danger-bg)]"
      }`}
    >
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
          value
            ? "border-[var(--color-warning)] bg-[var(--color-warning)]/30 justify-end"
            : "border-[var(--color-danger)] bg-[var(--color-danger)]/30 justify-start"
        } px-0.5`}
        aria-pressed={value}
        aria-label="Simulation mode"
      >
        <span
          className={`block h-4 w-4 rounded-full ${
            value ? "bg-[var(--color-warning)]" : "bg-[var(--color-danger)]"
          }`}
        />
      </button>
      <div className="flex-1">
        <div
          className={`t-eyebrow ${
            value
              ? "text-[var(--color-warning)]"
              : "text-[var(--color-danger)]"
          }`}
        >
          {value ? "Simulation mode" : "Real mode"}
        </div>
        <p className="mt-1 t-small text-[var(--color-text)]">
          {value
            ? "No transactions will be sent. The bot logs the close + swap quotes when the target is hit and stops."
            : "Transactions will be signed and broadcast to the chain. Use only when you're confident."}
        </p>
        <Link
          href="/docs/auto-exit"
          className="mt-2 inline-block t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          → What simulation actually does
        </Link>
      </div>
    </div>
  );
}
