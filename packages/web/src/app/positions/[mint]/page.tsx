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
import { Segmented } from "@/components/ui/Segmented";
import { trpc } from "@/lib/trpc";
import { NETWORK, RPC_URL } from "@/lib/constants";
import {
  formatBuffer,
  formatBufferRemaining,
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
  const settings = trpc.settings.get.useQuery();
  const network = settings.data?.network ?? NETWORK;
  const rpcUrl = settings.data?.rpcUrl ?? RPC_URL;

  // F6.1.b: agregamos los dos protocolos en paralelo para que la página
  // funcione tanto con posiciones Orca como Meteora (estas últimas son
  // read-only hasta F6.2).
  const orcaList = trpc.positions.listOwned.useQuery(
    {
      protocol: "orca",
      network,
      rpcUrl,
      owner: owner ?? "",
    },
    { enabled: !!owner && walletStatus.data?.unlocked === true },
  );
  const meteoraList = trpc.positions.listOwned.useQuery(
    {
      protocol: "meteora",
      network,
      rpcUrl,
      owner: owner ?? "",
    },
    { enabled: !!owner && walletStatus.data?.unlocked === true },
  );

  const allRefs = useMemo(
    () => [...(orcaList.data ?? []), ...(meteoraList.data ?? [])],
    [orcaList.data, meteoraList.data],
  );
  const posRef = useMemo(
    () => allRefs.find((r) => r.id === mint),
    [allRefs, mint],
  );
  const isLoading = orcaList.isLoading || meteoraList.isLoading;
  const firstError = orcaList.error ?? meteoraList.error;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow="Position"
        title="Configure the exit."
        back={{ href: "/", label: "Home" }}
      />

      {walletStatus.isLoading || isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">Loading…</p>
      ) : !walletStatus.data?.hasVault || !walletStatus.data.unlocked ? (
        <NeedWallet hasVault={walletStatus.data?.hasVault ?? false} />
      ) : !posRef && firstError ? (
        <p className="t-small text-[var(--color-danger)]">{firstError.message}</p>
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
  const settings = trpc.settings.get.useQuery();
  const network = settings.data?.network ?? NETWORK;
  const rpcUrl = settings.data?.rpcUrl ?? RPC_URL;

  const summary = trpc.positions.getSummary.useQuery({
    protocol: posRef.protocol,
    network,
    rpcUrl,
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
        <ConfigureForm
          mint={mint}
          posRef={posRef}
          summary={summary.data}
          router={router}
          network={network}
          rpcUrl={rpcUrl}
          defaults={{
            slippageBps: settings.data?.defaultSlippageBps,
            exitSlippageBps: settings.data?.defaultExitSlippageBps,
            pollMs: settings.data?.defaultPollMs,
          }}
        />
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
          <BufferLine
            bufferMs={task.takeProfitBufferMs}
            firstCrossedAt={task.runtime.tpFirstCrossedAt}
          />
        </Field>
        <Field label="Stop loss">
          <span className="t-num">
            {task.stopLossPrice !== null
              ? `≤ ${formatPrice(task.stopLossPrice, 6)}`
              : "—"}
          </span>
          <BufferLine
            bufferMs={task.stopLossBufferMs}
            firstCrossedAt={task.runtime.slFirstCrossedAt}
          />
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

/**
 * Línea bajo un trigger: "buffer 12h" + ("3h 14m left" si el cronómetro está
 * en marcha). Vacío si el trigger no tiene buffer configurado.
 */
function BufferLine({
  bufferMs,
  firstCrossedAt,
}: {
  bufferMs: number | null;
  firstCrossedAt: number | null;
}) {
  if (!bufferMs || bufferMs <= 0) return null;
  const remaining = formatBufferRemaining(firstCrossedAt, bufferMs, Date.now());
  return (
    <div className="mt-1 t-eyebrow text-[var(--color-text-dim)]">
      buffer {formatBuffer(bufferMs)}
      {remaining ? (
        <span
          className={`ml-2 ${
            remaining === "buffer met"
              ? "text-[var(--color-warning)]"
              : "text-[var(--color-accent-bright)]"
          }`}
        >
          · {remaining}
        </span>
      ) : null}
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

// Time buffer presets por trigger (ADR-025). 0 = off (dispara en el primer
// tick que cruza). Máximo 7d — más allá es ruido y la UX se complica.
const BUFFER_PRESETS: { ms: number; label: string }[] = [
  { ms: 0, label: "off" },
  { ms: 6 * 60 * 60 * 1000, label: "6h" },
  { ms: 12 * 60 * 60 * 1000, label: "12h" },
  { ms: 24 * 60 * 60 * 1000, label: "1d" },
  { ms: 3 * 24 * 60 * 60 * 1000, label: "3d" },
  { ms: 7 * 24 * 60 * 60 * 1000, label: "7d" },
];

function ConfigureForm({
  mint,
  posRef,
  summary,
  router,
  network,
  rpcUrl,
  defaults,
}: {
  mint: string;
  posRef: PositionRef;
  summary: PositionSummary;
  router: ReturnType<typeof useRouter>;
  network: "devnet" | "mainnet";
  rpcUrl: string;
  defaults: {
    slippageBps: number | undefined;
    exitSlippageBps: number | undefined;
    pollMs: number | undefined;
  };
}) {
  const { tokenA, tokenB, currentPrice } = summary;
  const symA = tokenSymbol(tokenA.mint);
  const symB = tokenSymbol(tokenB.mint);

  // Triggers independientes: cada uno tiene su toggle + su precio + su buffer.
  const [tpEnabled, setTpEnabled] = useState(true);
  const [tpPrice, setTpPrice] = useState("");
  const [tpBufferMs, setTpBufferMs] = useState(0);
  const [slEnabled, setSlEnabled] = useState(false);
  const [slPrice, setSlPrice] = useState("");
  const [slBufferMs, setSlBufferMs] = useState(0);

  // Defaults vienen del backend (F3.3). Si los presets típicos coinciden con
  // el default, los chips se marcan como activos; si el usuario configuró un
  // valor custom en /settings (75bps por ejemplo), state lo acepta y ningún
  // chip queda highlighted hasta que se haga click en uno.
  const [pollMs, setPollMs] = useState<number>(defaults.pollMs ?? 30_000);
  const [slippageBps, setSlippageBps] = useState<number>(
    defaults.slippageBps ?? 100,
  );
  const [exitChoice, setExitChoice] = useState<ExitChoice>("none");
  const [exitSlippageBps, setExitSlippageBps] = useState<number>(
    defaults.exitSlippageBps ?? 100,
  );
  // F6.3: simulation toggle oculto temporalmente. Default = real mode.
  // El state y SimulationToggle quedan en el código (ver bloque comentado
  // dentro del fieldset de Safety) para reactivar trivialmente si se quiere
  // volver a exponer. setSimulation no se llama hoy; el lint lo tolera porque
  // sigue siendo el setter de un state legítimo, solo que el JSX que lo
  // invocaba está comentado.
  const [simulation, setSimulation] = useState(false);
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
      // F6.2.c: el shape del protocolConfig varía por protocolo. Orca usa
      // positionMint + decimalsA/B + tokenMintA/B; Meteora usa lbPair +
      // position + decimalsX/Y + los mismos tokenMintA/B (que el receipt
      // y el verifier on-chain leen genéricamente).
      const protocolConfig =
        posRef.protocol === "meteora"
          ? {
              lbPair: posRef.poolId,
              position: posRef.id,
              decimalsX: tokenA.decimals,
              decimalsY: tokenB.decimals,
              decimalsA: tokenA.decimals,
              decimalsB: tokenB.decimals,
              tokenMintA: tokenA.mint,
              tokenMintB: tokenB.mint,
            }
          : {
              positionMint: mint,
              decimalsA: tokenA.decimals,
              decimalsB: tokenB.decimals,
              tokenMintA: tokenA.mint,
              tokenMintB: tokenB.mint,
            };

      const task = await create.mutateAsync({
        protocol: posRef.protocol,
        network,
        rpcUrl,
        positionId: mint,
        protocolConfig,
        takeProfitPrice: tpValid ? tpNum : null,
        stopLossPrice: slValid ? slNum : null,
        takeProfitBufferMs: tpValid && tpBufferMs > 0 ? tpBufferMs : null,
        stopLossBufferMs: slValid && slBufferMs > 0 ? slBufferMs : null,
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
          either price is hit (whichever happens first).{" "}
          <Link
            href="/docs/auto-exit#triggers"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            → How triggers work
          </Link>
        </p>

        <div className="mt-8 space-y-8">
          <TriggerInput
            kind="tp"
            enabled={tpEnabled}
            setEnabled={setTpEnabled}
            price={tpPrice}
            setPrice={setTpPrice}
            bufferMs={tpBufferMs}
            setBufferMs={setTpBufferMs}
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
            bufferMs={slBufferMs}
            setBufferMs={setSlBufferMs}
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
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <legend className="t-eyebrow">2 — What to do with the output</legend>
          <Link
            href="/docs/auto-exit#exit-token"
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
          >
            → docs
          </Link>
        </div>
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

        {/* F6.3: SimulationToggle oculto. Para re-exponerlo, descomenta
            esta línea y vuelve a poner el default de `simulation` a true.
        <SimulationToggle value={simulation} onChange={setSimulation} />
        */}

        <div>
          <Label>Close slippage tolerance</Label>
          <Segmented
            value={String(slippageBps)}
            onChange={(v) => setSlippageBps(Number(v))}
            options={SLIPPAGE_PRESETS.map((p) => ({
              value: String(p.bps),
              label: p.label,
            }))}
          />
          <p className="mt-3 max-w-lg t-small text-[var(--color-text-muted)]">
            How much the pool price is allowed to drift between submission and
            execution before the close transaction reverts. Higher values
            complete more reliably in volatile markets; lower values give a
            stricter price guarantee but can fail and retry more often.{" "}
            <Link
              href="/docs/auto-exit#slippage"
              className="text-[var(--color-accent-bright)] hover:underline"
            >
              → Read more
            </Link>
          </p>
        </div>
      </fieldset>

      {/* === Advanced === */}
      {/* F6.3: Poll interval ya no se expone aquí — usa el default del server
          (configurable en /settings). El state `pollMs` sigue existiendo con
          la default fallback para que reactivar el selector sea trivial.
          El bloque Advanced ahora solo aparece si hay exit swap configurado
          (única opción avanzada que queda). */}
      {exitChoice !== "none" ? (
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
                <Label>Exit swap slippage</Label>
                <Segmented
                  value={String(exitSlippageBps)}
                  onChange={(v) => setExitSlippageBps(Number(v))}
                  options={SLIPPAGE_PRESETS.map((p) => ({
                    value: String(p.bps),
                    label: p.label,
                  }))}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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

function TriggerInput({
  kind,
  enabled,
  setEnabled,
  price,
  setPrice,
  bufferMs,
  setBufferMs,
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
  bufferMs: number;
  setBufferMs: (v: number) => void;
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
        enabled
          ? kind === "tp"
            ? "border-[var(--color-positive)]"
            : "border-[var(--color-warning)]"
          : "border-[var(--color-border-strong)]"
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
          className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors px-0.5 ${
            enabled
              ? kind === "tp"
                ? "border-[var(--color-positive)] bg-[var(--color-positive)]/30 justify-end"
                : "border-[var(--color-warning)] bg-[var(--color-warning)]/30 justify-end"
              : "border-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] justify-start"
          }`}
        >
          <span
            className={`block h-3.5 w-3.5 rounded-full ${
              enabled
                ? kind === "tp"
                  ? "bg-[var(--color-positive)]"
                  : "bg-[var(--color-warning)]"
                : "bg-[var(--color-text-muted)]"
            }`}
          />
        </span>
        <span
          className={`t-eyebrow ${
            enabled
              ? kind === "tp"
                ? "text-[var(--color-positive)]"
                : "text-[var(--color-warning)]"
              : "text-[var(--color-text)]"
          }`}
        >
          {label}
        </span>
        <span
          className={`t-small ${
            enabled
              ? "text-[var(--color-text-muted)]"
              : "text-[var(--color-text)]"
          }`}
        >
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
                className="h-9 border border-[var(--color-border-strong)] hover:border-[var(--color-text)] bg-[var(--color-bg-elevated)] px-3.5 t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-lg transition-colors"
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

          {/* Time buffer (ADR-025): el precio debe mantenerse en zona durante
              este tiempo antes de disparar. Reset duro si sale de la zona. */}
          <div className="mt-6">
            <Label>Time buffer</Label>
            <Segmented
              value={String(bufferMs)}
              onChange={(v) => setBufferMs(Number(v))}
              options={BUFFER_PRESETS.map((p) => ({
                value: String(p.ms),
                label: p.label,
              }))}
            />
            <p className="mt-2 max-w-md t-small text-[var(--color-text-muted)]">
              {bufferMs > 0
                ? `Close only if the price stays ${
                    kind === "tp" ? "above" : "below"
                  } the target for at least this long. If it leaves the zone, the timer resets.`
                : `Fire as soon as the price crosses the target — no waiting.`}{" "}
              <Link
                href="/docs/auto-exit#time-buffer"
                className="text-[var(--color-accent-bright)] hover:underline"
              >
                → Read more
              </Link>
            </p>
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
