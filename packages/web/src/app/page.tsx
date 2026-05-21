"use client";

import Link from "next/link";
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { useConnectWallet } from "@/lib/connect-wallet";
import { useT } from "@/i18n/context";
import { statusView, TONE_CLASSES, type BackendStatus } from "@/lib/status";
import {
  formatDistance,
  formatPrice,
  formatTaskPair,
  formatTimeAgo,
  formatTriggers,
  truncateAddress,
} from "@/lib/format";
import { tokenSymbol } from "@/lib/tokens";
import {
  NETWORK,
  PROTOCOL_LABELS,
  type ProtocolName,
  RPC_URL,
} from "@/lib/constants";

type TaskRow = inferRouterOutputs<AppRouter>["tasks"]["list"][number];
type PositionRef = inferRouterOutputs<AppRouter>["positions"]["listOwned"][number];

const ACTIVE_STATES: BackendStatus[] = [
  "idle",
  "armed",
  "triggered",
  "closing",
  "paused",
];
const FINISHED_STATES: BackendStatus[] = ["done", "error", "stopped"];

export default function Home() {
  const walletStatus = trpc.wallet.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  if (walletStatus.isLoading) {
    return <main className="mx-auto max-w-6xl px-6 pt-16" />;
  }
  if (!walletStatus.data?.hasVault) {
    return <FirstRunHome />;
  }
  return (
    <ConnectedHome
      owner={walletStatus.data.address}
      unlocked={walletStatus.data.unlocked}
    />
  );
}

// ============================================================================
// Connected home — el usuario ya tiene wallet. Hub directo de posiciones.
// ============================================================================

function ConnectedHome({
  owner,
  unlocked,
}: {
  owner: string | null;
  unlocked: boolean;
}) {
  const settings = trpc.settings.get.useQuery();
  const network = settings.data?.network ?? NETWORK;
  const rpcUrl = settings.data?.rpcUrl ?? RPC_URL;

  // Listamos posiciones de ambos protocolos en paralelo. La query solo
  // se dispara cuando hay owner — el peek-address del vault funciona
  // incluso locked, así que el listado se ve también en estado locked.
  const orcaList = trpc.positions.listOwned.useQuery(
    { protocol: "orca", network, rpcUrl, owner: owner ?? "" },
    { enabled: !!owner },
  );
  const meteoraList = trpc.positions.listOwned.useQuery(
    { protocol: "meteora", network, rpcUrl, owner: owner ?? "" },
    { enabled: !!owner },
  );

  const tasks = trpc.tasks.list.useQuery(undefined, { refetchInterval: 3_000 });

  // Mapa positionId → task activa (regla "una posición = un auto-exit" → ADR-019).
  const activeByPosition = new Map<string, TaskRow>();
  for (const t of tasks.data ?? []) {
    if (ACTIVE_STATES.includes(t.status as BackendStatus)) {
      activeByPosition.set(t.positionId, t);
    }
  }

  const allRefs: PositionRef[] = [
    ...(orcaList.data ?? []),
    ...(meteoraList.data ?? []),
  ];
  const isLoadingAll = orcaList.isLoading && meteoraList.isLoading;
  const watchingCount = allRefs.filter((r) =>
    activeByPosition.has(r.id),
  ).length;

  const finished = (tasks.data ?? []).filter((t) =>
    FINISHED_STATES.includes(t.status as BackendStatus),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32 pt-12 fade-in">
      <BotWalletEyebrow
        owner={owner}
        unlocked={unlocked}
        totalPositions={allRefs.length}
        watchingCount={watchingCount}
        loadingPositions={isLoadingAll}
      />

      <PositionsHub
        refs={allRefs}
        activeByPosition={activeByPosition}
        network={network}
        rpcUrl={rpcUrl}
        owner={owner}
        isLoading={isLoadingAll}
        anyError={
          orcaList.error?.message ?? meteoraList.error?.message ?? null
        }
      />

      <RecentActivity tasks={finished} />
    </main>
  );
}

// ============================================================================
// Eyebrow — bot wallet address + counters
// ============================================================================

function BotWalletEyebrow({
  owner,
  unlocked,
  totalPositions,
  watchingCount,
  loadingPositions,
}: {
  owner: string | null;
  unlocked: boolean;
  totalPositions: number;
  watchingCount: number;
  loadingPositions: boolean;
}) {
  const { t } = useT();
  return (
    <section className="pb-8 hairline-b">
      <div className="flex items-baseline justify-between gap-3">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {t.home.eyebrow.botWallet}
          {unlocked ? null : (
            <span className="ml-2 text-[var(--color-warning)]">
              {t.home.eyebrow.locked}
            </span>
          )}
        </div>
        <Link
          href="/docs/bot-wallet"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          {t.home.eyebrow.whatIs}
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <span className="t-num break-all text-[var(--color-text)]">
          {owner ? truncateAddress(owner, 8, 8) : "—"}
        </span>
        <span className="t-eyebrow text-[var(--color-text-dim)]">·</span>
        <span className="t-small text-[var(--color-text-muted)]">
          {loadingPositions
            ? t.home.eyebrow.loadingPositions
            : totalPositions === 1
              ? t.home.eyebrow.onePosition
              : t.home.eyebrow.manyPositions(totalPositions)}
        </span>
        {watchingCount > 0 ? (
          <>
            <span className="t-eyebrow text-[var(--color-text-dim)]">·</span>
            <span className="inline-flex items-center gap-2 t-small text-[var(--color-positive)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-positive)] pulse-soft" />
              {watchingCount === 1
                ? t.home.eyebrow.oneWatching
                : t.home.eyebrow.manyWatching(watchingCount)}
            </span>
          </>
        ) : null}
      </div>
    </section>
  );
}

// ============================================================================
// Positions hub — la tabla principal del home
// ============================================================================

function PositionsHub({
  refs,
  activeByPosition,
  network,
  rpcUrl,
  owner,
  isLoading,
  anyError,
}: {
  refs: PositionRef[];
  activeByPosition: Map<string, TaskRow>;
  network: "devnet" | "mainnet";
  rpcUrl: string;
  owner: string | null;
  isLoading: boolean;
  anyError: string | null;
}) {
  const { t } = useT();
  const hubT = t.home.hub;
  if (isLoading && refs.length === 0) {
    return (
      <section className="pt-8">
        <p className="t-small text-[var(--color-text-muted)]">
          {hubT.loading}
        </p>
      </section>
    );
  }

  if (refs.length === 0) {
    return <EmptyHub owner={owner} />;
  }

  return (
    <section className="pt-8">
      {/* Column headers — solo en md+; en mobile la fila se apila */}
      <div className="hidden hairline-b pb-3 md:grid md:grid-cols-12 md:items-baseline md:gap-4">
        <div className="md:col-span-2 t-eyebrow text-[var(--color-text-dim)]">
          {hubT.headerStatus}
        </div>
        <div className="md:col-span-3 t-eyebrow text-[var(--color-text-dim)]">
          {hubT.headerPosition}
        </div>
        <div className="md:col-span-5 t-eyebrow text-[var(--color-text-dim)]">
          {hubT.headerAutoExit}
        </div>
        <div className="md:col-span-2 t-eyebrow text-[var(--color-text-dim)] md:text-right">
          {hubT.headerAction}
        </div>
      </div>

      <ul className="divide-y divide-[var(--color-hairline)]">
        {refs.map((ref) => (
          <PositionHubRow
            key={`${ref.protocol}:${ref.id}`}
            posRef={ref}
            activeTask={activeByPosition.get(ref.id) ?? null}
            network={network}
            rpcUrl={rpcUrl}
          />
        ))}
      </ul>

      {anyError ? (
        <p className="mt-6 t-small text-[var(--color-danger)]">
          {hubT.oneProtocolFailed(anyError)}
        </p>
      ) : null}
    </section>
  );
}

function PositionHubRow({
  posRef,
  activeTask,
  network,
  rpcUrl,
}: {
  posRef: PositionRef;
  activeTask: TaskRow | null;
  network: "devnet" | "mainnet";
  rpcUrl: string;
}) {
  const { t } = useT();
  const summary = trpc.positions.getSummary.useQuery({
    protocol: posRef.protocol,
    network,
    rpcUrl,
    ref: posRef,
  });

  const view = activeTask ? statusView(activeTask.status as BackendStatus) : null;
  const tone = view ? TONE_CLASSES[view.tone] : null;
  const statusLabel = activeTask
    ? t.status[activeTask.status as BackendStatus]?.label ?? activeTask.status
    : null;

  const symA = summary.data ? tokenSymbol(summary.data.tokenA.mint) : null;
  const symB = summary.data ? tokenSymbol(summary.data.tokenB.mint) : null;
  const protocolLabel =
    PROTOCOL_LABELS[posRef.protocol as ProtocolName] ?? posRef.protocol;

  return (
    <li className="grid grid-cols-12 items-baseline gap-x-4 gap-y-1 py-5 md:gap-y-0">
      {/* Status */}
      <div className="col-span-12 md:col-span-2">
        {view && tone ? (
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot} ${
                view.pulsing ? "pulse-soft" : ""
              }`}
            />
            <span className={`t-eyebrow ${tone.text}`}>{statusLabel}</span>
            {activeTask?.dryRun ? (
              <span className="t-eyebrow text-[var(--color-warning)]">
                {t.format.sim}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full border border-[var(--color-text-dim)]" />
            <span className="t-eyebrow text-[var(--color-text-dim)]">
              {t.status.noExit}
            </span>
          </div>
        )}
      </div>

      {/* Position */}
      <div className="col-span-12 md:col-span-3">
        <div className="t-h3 text-[var(--color-text)]">
          {symA && symB ? (
            <>
              {symA}{" "}
              <span className="text-[var(--color-text-muted)]">/</span>{" "}
              {symB}
            </>
          ) : (
            <span className="t-num text-[var(--color-text)]">
              {truncateAddress(posRef.id, 4, 4)}
            </span>
          )}
        </div>
        {/* Sub-línea con rango + in/out + protocolo. El rango distingue
            posiciones del mismo pool (pool trading: la misma pareja en
            varios rangos a la vez). */}
        <div className="mt-1 flex items-center gap-2">
          {summary.data ? (
            <>
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  summary.data.isInRange
                    ? "bg-[var(--color-positive)]"
                    : "bg-[var(--color-danger)]"
                }`}
                title={
                  summary.data.isInRange ? "In your range" : "Out of range"
                }
              />
              <span className="t-num text-xs text-[var(--color-text-muted)]">
                {formatPrice(summary.data.range.min, 2)}
                <span className="text-[var(--color-text-dim)]">–</span>
                {formatPrice(summary.data.range.max, 2)}
              </span>
              <span className="t-eyebrow text-[var(--color-text-dim)]">·</span>
              <span
                className={`t-eyebrow ${
                  posRef.protocol === "meteora"
                    ? "text-[var(--color-accent-bright)]"
                    : "text-[var(--color-text-dim)]"
                }`}
              >
                {protocolLabel}
              </span>
            </>
          ) : (
            <span className="t-eyebrow text-[var(--color-text-dim)]">
              <span
                className={
                  posRef.protocol === "meteora"
                    ? "text-[var(--color-accent-bright)]"
                    : ""
                }
              >
                {protocolLabel}
              </span>{" "}
              · {posRef.label.split(" ").slice(-1)[0]}
            </span>
          )}
        </div>
      </div>

      {/* Auto-exit: trigger + distancia. Solo se rellena si hay watcher
          activo. Para "No exit" la celda queda vacía — sin guiones, sin
          ruido (el CTA Action ya lleva al setup). */}
      <div className="col-span-12 md:col-span-5">
        {activeTask ? (
          <AutoExitCell task={activeTask} currentPrice={summary.data?.currentPrice ?? null} />
        ) : null}
      </div>

      {/* Action */}
      <div className="col-span-12 md:col-span-2 md:text-right">
        {activeTask ? (
          <Link
            href={`/tasks/${activeTask.id}`}
            className="t-eyebrow text-[var(--color-accent-bright)] hover:underline"
          >
            {t.common.details}
          </Link>
        ) : (
          <Link
            href={`/positions/${posRef.id}`}
            className="t-eyebrow text-[var(--color-accent-bright)] hover:underline"
          >
            {t.common.autoExit}
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * Celda Auto-exit de PositionsHub: muestra trigger(s) configurado(s) en
 * primera línea + distancia a CADA UNO en segunda. Si hay TP y SL,
 * ambas distancias se renderizan separadas; si solo uno, solo ese. Cada
 * distancia se pinta en warning si ya está reached, muted en otro caso.
 */
function AutoExitCell({
  task,
  currentPrice,
}: {
  task: TaskRow;
  currentPrice: number | null;
}) {
  const triggers = formatTriggers(
    task.takeProfitPrice,
    task.stopLossPrice,
    4,
  );
  const current = currentPrice ?? task.runtime.lastPrice;
  const tpDist =
    task.takeProfitPrice !== null
      ? formatDistance(current, task.takeProfitPrice, "above")
      : null;
  const slDist =
    task.stopLossPrice !== null
      ? formatDistance(current, task.stopLossPrice, "below")
      : null;
  const hasAnyDistance =
    (tpDist && tpDist.pct !== null) || (slDist && slDist.pct !== null);

  return (
    <div>
      <div className="t-num text-[var(--color-text)]">{triggers}</div>
      {hasAnyDistance ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 t-eyebrow">
          {tpDist && tpDist.pct !== null ? (
            <span
              className={
                tpDist.reached
                  ? "text-[var(--color-warning)]"
                  : "text-[var(--color-text-dim)]"
              }
            >
              {tpDist.text} TP
            </span>
          ) : null}
          {tpDist?.pct !== null && slDist?.pct !== null ? (
            <span className="text-[var(--color-text-dim)]">·</span>
          ) : null}
          {slDist && slDist.pct !== null ? (
            <span
              className={
                slDist.reached
                  ? "text-[var(--color-warning)]"
                  : "text-[var(--color-text-dim)]"
              }
            >
              {slDist.text} SL
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Empty hub — el wallet existe pero no tiene posiciones LP
// ============================================================================

function EmptyHub({ owner }: { owner: string | null }) {
  const { t } = useT();
  const emptyT = t.home.emptyHub;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!owner) return;
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
      <div className="t-eyebrow text-[var(--color-text-muted)]">
        {emptyT.eyebrow}
      </div>
      <h2 className="mt-3 t-h2">{emptyT.title}</h2>
      <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
        {emptyT.intro}
      </p>

      {owner ? (
        <div className="mt-8 hairline-t hairline-b py-5">
          <div className="t-eyebrow text-[var(--color-text-muted)]">
            {emptyT.addressLabel}
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
              {copied ? emptyT.copied : emptyT.copy}
            </button>
          </div>
        </div>
      ) : null}

      <ol className="mt-8 divide-y divide-[var(--color-hairline)]">
        <EmptyPath
          n="01"
          title={emptyT.path1Title}
          body={emptyT.path1Body}
        />
        <EmptyPath
          n="02"
          title={emptyT.path2Title}
          body={emptyT.path2Body}
        />
      </ol>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <a
          href={`https://www.orca.so/?network=${NETWORK}`}
          target="_blank"
          rel="noopener noreferrer"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          {emptyT.openOrca}
        </a>
        <a
          href="https://app.meteora.ag/dlmm"
          target="_blank"
          rel="noopener noreferrer"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          {emptyT.openMeteora}
        </a>
        <Link
          href="/docs/getting-started"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          {emptyT.stepByStep}
        </Link>
      </div>
    </section>
  );
}

function EmptyPath({
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
        <h3 className="t-h3 text-[var(--color-text)]">{title}</h3>
      </div>
      <div className="col-span-12 md:col-span-7">
        <p className="t-body text-[var(--color-text-muted)]">{body}</p>
      </div>
    </li>
  );
}

// ============================================================================
// Recent activity — feed condensado de tasks terminadas
// ============================================================================

interface CloseResultShape {
  dryRun?: boolean;
  txId?: string;
}

function isSlippageError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("slippage") ||
    m.includes("tolerance") ||
    m.includes("price impact") ||
    m.includes("0x1782")
  );
}

function RecentActivity({ tasks }: { tasks: TaskRow[] }) {
  const { t } = useT();
  const actT = t.home.activity;
  if (tasks.length === 0) return null;

  return (
    <section className="hairline-t mt-12 pt-10">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="t-eyebrow text-[var(--color-text-muted)]">
            {actT.eyebrow}
          </div>
          <h2 className="mt-2 t-h2">{actT.title}</h2>
        </div>
        <Link
          href="/tasks"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          {actT.viewAll}
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left t-eyebrow text-[var(--color-text-dim)]">
              <th className="pb-3 pr-4 font-normal">{actT.headerWhen}</th>
              <th className="pb-3 pr-4 font-normal">{actT.headerPosition}</th>
              <th className="pb-3 pr-4 font-normal">{actT.headerTrigger}</th>
              <th className="pb-3 pr-4 font-normal">{actT.headerResult}</th>
              <th className="pb-3 pr-4 font-normal">{actT.headerTxError}</th>
              <th className="pb-3 font-normal text-right">&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {tasks.slice(0, 8).map((t) => (
              <LedgerRow key={t.id} task={t} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LedgerRow({ task }: { task: TaskRow }) {
  const { t } = useT();
  const when = task.triggeredAt
    ? new Date(task.triggeredAt).getTime()
    : new Date(task.updatedAt).getTime();
  const closeShape = task.closeResult as CloseResultShape | null;

  return (
    <tr className="group">
      <td className="py-4 pr-4 align-top t-num text-[var(--color-text-muted)]">
        {formatTimeAgo(when, t)}
      </td>
      <td className="py-4 pr-4 align-top t-small text-[var(--color-text)]">
        {(() => {
          const pair = formatTaskPair(task.protocolConfig);
          return pair ? (
            <>
              {pair}{" "}
              <span className="t-eyebrow text-[var(--color-text-dim)]">
                · {task.protocol}
              </span>
            </>
          ) : (
            <>
              {task.protocol} · {truncateAddress(task.positionId, 4, 4)}
            </>
          );
        })()}
      </td>
      <td className="py-4 pr-4 align-top t-num text-[var(--color-text)]">
        {formatTriggers(task.takeProfitPrice, task.stopLossPrice, 4)}
        {task.exitTokenMint ? (
          <span className="ml-2 t-eyebrow text-[var(--color-text-dim)]">
            → {tokenSymbol(task.exitTokenMint)}
          </span>
        ) : null}
      </td>
      <td className="py-4 pr-4 align-top">
        <ResultChip task={task} />
      </td>
      <td className="py-4 pr-4 align-top">
        <TxOrError task={task} closeShape={closeShape} />
      </td>
      <td className="py-4 align-top text-right">
        <Link
          href={`/tasks/${task.id}`}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)]"
        >
          open →
        </Link>
      </td>
    </tr>
  );
}

/**
 * Chip de resultado: distingue visualmente Closed / Failed / Stopped en lugar
 * de mostrar el label genérico de estado. Para errores, anota la causa
 * detectada (slippage si aplica).
 */
function ResultChip({ task }: { task: TaskRow }) {
  const { t } = useT();
  const actT = t.home.activity;
  if (task.status === "done") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-positive)]" />
        <span className="t-eyebrow text-[var(--color-positive)]">
          {actT.resultClosed}
        </span>
        {task.dryRun ? (
          <span className="t-eyebrow text-[var(--color-warning)]">
            {t.format.sim}
          </span>
        ) : null}
      </div>
    );
  }
  if (task.status === "error") {
    const slip = task.lastError ? isSlippageError(task.lastError) : false;
    return (
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-danger)]" />
        <span className="t-eyebrow text-[var(--color-danger)]">
          {actT.resultFailed}
        </span>
        {slip ? (
          <span className="t-eyebrow text-[var(--color-text-muted)]">
            {actT.slippageTag}
          </span>
        ) : null}
      </div>
    );
  }
  // stopped
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-text-dim)]" />
      <span className="t-eyebrow text-[var(--color-text-muted)]">
        {actT.resultStopped}
      </span>
    </div>
  );
}

/**
 * Para closes exitosos: link a Solscan con la signature. Para errores:
 * preview del mensaje (truncado a una línea, hover muestra el completo).
 * Stopped o dry-run: dash.
 */
function TxOrError({
  task,
  closeShape,
}: {
  task: TaskRow;
  closeShape: CloseResultShape | null;
}) {
  const { t } = useT();
  if (task.status === "done" && closeShape?.txId && !closeShape.dryRun) {
    const cluster = task.network === "mainnet" ? "" : "?cluster=devnet";
    return (
      <a
        href={`https://solscan.io/tx/${closeShape.txId}${cluster}`}
        target="_blank"
        rel="noopener noreferrer"
        className="t-eyebrow text-[var(--color-accent-bright)] hover:underline t-num"
      >
        {truncateAddress(closeShape.txId, 4, 4)} ↗
      </a>
    );
  }
  if (task.status === "done" && closeShape?.dryRun) {
    return (
      <span className="t-eyebrow text-[var(--color-text-dim)]">
        {t.home.activity.simulated}
      </span>
    );
  }
  if (task.status === "error" && task.lastError) {
    return (
      <span
        title={task.lastError}
        className="t-small text-[var(--color-text-muted)] line-clamp-1 max-w-xs"
      >
        {task.lastError}
      </span>
    );
  }
  return <span className="t-eyebrow text-[var(--color-text-dim)]">—</span>;
}

// ============================================================================
// First-run home — el usuario aún no tiene wallet
// ============================================================================

function FirstRunHome() {
  const connect = useConnectWallet();
  const { t } = useT();
  const fr = t.home.firstRun;
  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-16 fade-in">
      <section className="pb-20">
        <div className="t-eyebrow text-[var(--color-accent-bright)]">
          {fr.eyebrow}
        </div>
        <h1 className="mt-4 t-display">
          {fr.titleLine1}
          <br />
          <em
            className="font-normal not-italic text-[var(--color-text-muted)]"
            style={{ fontVariationSettings: '"opsz" 100, "SOFT" 80, "WONK" 1' }}
          >
            {fr.titleLine2}
          </em>
        </h1>
        <p className="mt-10 max-w-xl t-body text-[var(--color-text-muted)]">
          {fr.intro}
        </p>
      </section>

      <section className="hairline-t pt-12">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {fr.stepsEyebrow}
        </div>
        <h2 className="mt-2 t-h2">{fr.stepsTitle}</h2>

        <ol className="mt-10 divide-y divide-[var(--color-hairline)]">
          <Step n="01" title={fr.step1Title} body={fr.step1Body} />
          <Step n="02" title={fr.step2Title} body={fr.step2Body} />
          <Step n="03" title={fr.step3Title} body={fr.step3Body} />
        </ol>
      </section>

      <section className="hairline-t mt-12 pt-12">
        <div className="flex flex-wrap items-baseline gap-4">
          <Button onClick={connect.open}>{fr.ctaCreateWallet}</Button>
          <Link
            href="/docs/getting-started"
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
          >
            {fr.ctaReadGuide}
          </Link>
          <span className="t-small text-[var(--color-text-dim)]">
            {fr.stepHint}
          </span>
        </div>
      </section>

      <aside className="hairline-t mt-12 max-w-xl pt-10">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {fr.localEyebrow}
        </div>
        <p className="mt-3 t-small text-[var(--color-text-dim)]">
          {fr.localBody}
        </p>
        <Link
          href="/docs/disclaimer"
          className="mt-4 inline-block t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
        >
          {fr.disclaimerLink}
        </Link>
      </aside>
    </main>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="grid grid-cols-12 gap-4 py-8 first:pt-0 md:gap-6">
      <div className="col-span-12 md:col-span-2">
        <span className="t-num text-[var(--color-accent-bright)]">{n}</span>
      </div>
      <div className="col-span-12 md:col-span-3">
        <h3 className="t-h2">{title}</h3>
      </div>
      <div className="col-span-12 md:col-span-7">
        <p className="t-body text-[var(--color-text-muted)]">{body}</p>
      </div>
    </li>
  );
}
