"use client";

import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { useConnectWallet } from "@/lib/connect-wallet";
import { statusView, TONE_CLASSES } from "@/lib/status";
import {
  formatNearestDistance,
  formatPrice,
  formatTimeAgo,
  formatTriggers,
  truncateAddress,
} from "@/lib/format";
import { tokenSymbol } from "@/lib/tokens";

type TaskRow = inferRouterOutputs<AppRouter>["tasks"]["list"][number];

export default function Home() {
  const tasks = trpc.tasks.list.useQuery(undefined, { refetchInterval: 3_000 });
  const walletStatus = trpc.wallet.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  const hasWallet = walletStatus.data?.hasVault ?? false;

  // First-run: la home explica el modelo y dirige al modal. Aún no hay nada
  // que listar en "Now watching" o "Recent activity", así que esas secciones
  // serían ruido.
  if (walletStatus.isLoading) {
    return <main className="mx-auto max-w-6xl px-6 pt-16" />;
  }
  if (!hasWallet) {
    return <FirstRunHome />;
  }

  const active = (tasks.data ?? []).filter((t) =>
    ["armed", "triggered", "closing", "idle"].includes(t.status),
  );
  const finished = (tasks.data ?? []).filter((t) =>
    ["done", "error", "stopped", "paused"].includes(t.status),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32 pt-16 fade-in">
      <DashboardHero
        activeCount={active.length}
        totalCount={tasks.data?.length ?? 0}
      />

      <NowWatching tasks={active} />

      <Recent tasks={finished} loading={tasks.isLoading} />
    </main>
  );
}

// ============================================================================
// First-run home — el usuario aún no tiene wallet
// ============================================================================

function FirstRunHome() {
  const connect = useConnectWallet();
  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-16 fade-in">
      <section className="pb-20">
        <div className="t-eyebrow text-[var(--color-accent-bright)]">
          auto exits para pools de liquidez en Solana
        </div>
        <h1 className="mt-4 t-display">
          Set the conditions.
          <br />
          <em
            className="font-normal not-italic text-[var(--color-text-muted)]"
            style={{ fontVariationSettings: '"opsz" 100, "SOFT" 80, "WONK" 1' }}
          >
            Walk away.
          </em>
        </h1>
        <p className="mt-10 max-w-xl t-body text-[var(--color-text-muted)]">
          Auto-Exit watches your Orca (and soon Meteora) liquidity positions
          every few seconds and closes them when price hits your take-profit
          or stop-loss. It runs on this machine and signs with a wallet you
          control.
        </p>
      </section>

      <section className="hairline-t pt-12">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          How it works
        </div>
        <h2 className="mt-2 t-h2">Three steps, then nothing.</h2>

        <ol className="mt-10 divide-y divide-[var(--color-hairline)]">
          <Step
            n="01"
            title="Bot wallet"
            body="A dedicated Solana account whose key lives encrypted on this machine. The bot uses it to sign the close transaction when triggers fire — including while you're asleep. That's the part Phantom-style popups can't do."
          />
          <Step
            n="02"
            title="Funded positions"
            body="Fund the bot wallet with SOL (for fees) and the tokens you want it to manage. Open new LP positions from it on Orca, or transfer the NFT of an existing position to it."
          />
          <Step
            n="03"
            title="Triggers"
            body="For each position, set a take-profit price, a stop-loss price, or both. The bot closes when whichever hits first; optionally swaps the proceeds into a stable."
          />
        </ol>
      </section>

      <section className="hairline-t mt-12 pt-12">
        <div className="flex flex-wrap items-baseline gap-4">
          <Button onClick={connect.open}>Create the bot&apos;s wallet →</Button>
          <Link
            href="/docs/getting-started"
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
          >
            Read the full guide →
          </Link>
          <span className="t-small text-[var(--color-text-dim)]">
            Step 1 of 3 · stop and resume at any point.
          </span>
        </div>
      </section>

      <aside className="hairline-t mt-12 max-w-xl pt-10">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          Local stack
        </div>
        <p className="mt-3 t-small text-[var(--color-text-dim)]">
          The server listens on localhost only. Your wallet key is encrypted at
          rest with your passphrase and decrypted in memory only while
          unlocked — nothing about your wallet, positions, or trades leaves
          this machine.
        </p>
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

// ============================================================================
// Dashboard hero — el usuario ya tiene wallet
// ============================================================================

function DashboardHero({
  activeCount,
  totalCount,
}: {
  activeCount: number;
  totalCount: number;
}) {
  return (
    <section className="grid gap-10 pb-16 md:grid-cols-12">
      <div className="md:col-span-7">
        <div className="t-eyebrow text-[var(--color-accent-bright)]">
          auto exits para pools de liquidez en Solana
        </div>
        <h1 className="mt-4 t-display">
          Set the conditions.
          <br />
          <em
            className="font-normal not-italic text-[var(--color-text-muted)]"
            style={{ fontVariationSettings: '"opsz" 100, "SOFT" 80, "WONK" 1' }}
          >
            Walk away.
          </em>
        </h1>
        <p className="mt-6 max-w-md t-body text-[var(--color-text-muted)]">
          Watch your Orca and (soon) Meteora positions and close them when the
          price hits your target. Take profit on a rise, cut a loss on a drop,
          optionally swap the output to a stable.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/positions">
            <Button>Set up an auto-exit →</Button>
          </Link>
          <Link href="/tasks">
            <Button variant="ghost">All auto-exits ({totalCount})</Button>
          </Link>
        </div>
      </div>

      <aside className="md:col-span-5 md:border-l md:border-[var(--color-hairline)] md:pl-10">
        <div className="t-eyebrow">Live</div>
        <div className="mt-3 flex items-baseline gap-4">
          <span className="t-num-display tabular-nums">{activeCount}</span>
          <span className="t-body text-[var(--color-text-muted)]">
            {activeCount === 1 ? "auto-exit watching" : "auto-exits watching"}
          </span>
        </div>
        <p className="mt-6 max-w-xs t-small text-[var(--color-text-dim)]">
          All transactions stay on this machine. Your wallet key is decrypted
          in memory only while unlocked; nothing leaves your localhost.
        </p>
      </aside>
    </section>
  );
}

// ============================================================================
// Now watching (active tasks)
// ============================================================================

function NowWatching({ tasks }: { tasks: TaskRow[] }) {
  if (tasks.length === 0) {
    return (
      <section className="hairline-t pt-10">
        <SectionHeader eyebrow="Now watching" title="Nothing armed">
          You haven&apos;t set up any auto-exits yet. Open a position in
          Orca, then set one up from this dashboard.
        </SectionHeader>
      </section>
    );
  }

  return (
    <section className="hairline-t pt-10">
      <SectionHeader eyebrow="Now watching" title="Active auto-exits" />

      {/* Column headers — visible solo en md+ porque en mobile la fila se apila */}
      <div className="mt-8 hidden hairline-b pb-3 md:grid md:grid-cols-12 md:gap-4">
        <div className="md:col-span-3 t-eyebrow text-[var(--color-text-dim)]">
          Status
        </div>
        <div className="md:col-span-3 t-eyebrow text-[var(--color-text-dim)]">
          Position
        </div>
        <div className="md:col-span-3 t-eyebrow text-[var(--color-text-dim)]">
          Triggers
        </div>
        <div className="md:col-span-2 t-eyebrow text-[var(--color-text-dim)]">
          Current price
        </div>
        <div className="md:col-span-1 t-eyebrow text-[var(--color-text-dim)] md:text-right">
          Distance
        </div>
      </div>

      <ul className="divide-y divide-[var(--color-hairline)]">
        {tasks.map((t) => (
          <ActiveTaskRow key={t.id} task={t} />
        ))}
      </ul>
    </section>
  );
}

function ActiveTaskRow({ task }: { task: TaskRow }) {
  const view = statusView(task.status);
  const tone = TONE_CLASSES[view.tone];
  const distance = formatNearestDistance(
    task.runtime.lastPrice,
    task.takeProfitPrice,
    task.stopLossPrice,
  );

  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="block py-5 transition-colors hover:bg-white/[0.02] md:grid md:grid-cols-12 md:items-baseline md:gap-4"
      >
        <div className="flex items-center gap-2 md:col-span-3">
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
        <div className="mt-1 t-small text-[var(--color-text-muted)] md:col-span-3 md:mt-0">
          {task.protocol} · {truncateAddress(task.positionId, 4, 4)}
        </div>
        <div className="mt-1 t-num text-[var(--color-text-muted)] md:col-span-3 md:mt-0">
          <span className="t-eyebrow mr-2 text-[var(--color-text-dim)] md:hidden">
            triggers
          </span>
          <span className="text-[var(--color-text)]">
            {formatTriggers(task.takeProfitPrice, task.stopLossPrice, 4)}
          </span>
        </div>
        <div className="mt-1 t-num text-[var(--color-text)] md:col-span-2 md:mt-0">
          <span className="t-eyebrow mr-2 text-[var(--color-text-dim)] md:hidden">
            current
          </span>
          {task.runtime.lastPrice !== null
            ? formatPrice(task.runtime.lastPrice, 4)
            : "—"}
        </div>
        <div className="t-num text-[var(--color-text-muted)] md:col-span-1 md:text-right">
          <span className="t-eyebrow mr-2 text-[var(--color-text-dim)] md:hidden">
            distance
          </span>
          {distance.pct !== null ? distance.text : "—"}
        </div>
      </Link>
    </li>
  );
}

// ============================================================================
// Recent (ledger)
// ============================================================================

function Recent({
  tasks,
  loading,
}: {
  tasks: TaskRow[];
  loading: boolean;
}) {
  return (
    <section className="hairline-t mt-10 pt-10">
      <SectionHeader eyebrow="History" title="Recent activity" />
      {loading ? (
        <p className="mt-6 t-small text-[var(--color-text-dim)]">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="mt-6 max-w-md t-small text-[var(--color-text-dim)]">
          No closed tasks yet. When a watcher fires, it lands here with its
          transactions for the record.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left t-eyebrow text-[var(--color-text-dim)]">
                <th className="pb-3 font-normal">Date</th>
                <th className="pb-3 font-normal">Position</th>
                <th className="pb-3 font-normal">Trigger</th>
                <th className="pb-3 font-normal">Status</th>
                <th className="pb-3 font-normal text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {tasks.slice(0, 12).map((t) => (
                <LedgerRow key={t.id} task={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LedgerRow({ task }: { task: TaskRow }) {
  const view = statusView(task.status);
  const tone = TONE_CLASSES[view.tone];
  const when = task.triggeredAt
    ? new Date(task.triggeredAt).getTime()
    : new Date(task.updatedAt).getTime();

  return (
    <tr className="group">
      <td className="py-4 align-top t-num text-[var(--color-text-muted)]">
        {formatTimeAgo(when)}
      </td>
      <td className="py-4 align-top t-small text-[var(--color-text)]">
        {task.protocol} · {truncateAddress(task.positionId, 4, 4)}
      </td>
      <td className="py-4 align-top t-num text-[var(--color-text)]">
        {formatTriggers(task.takeProfitPrice, task.stopLossPrice, 4)}
        {task.exitTokenMint ? (
          <span className="ml-2 t-eyebrow text-[var(--color-text-dim)]">
            → {tokenSymbol(task.exitTokenMint)}
          </span>
        ) : null}
      </td>
      <td className="py-4 align-top">
        <span className={`t-eyebrow ${tone.text}`}>{view.label}</span>
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

// ============================================================================
// Section header (eyebrow + title)
// ============================================================================

function SectionHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 md:flex-row md:items-baseline md:justify-between">
      <div>
        <div className="t-eyebrow text-[var(--color-text-muted)]">{eyebrow}</div>
        <h2 className="mt-2 t-h2">{title}</h2>
      </div>
      {children ? (
        <p className="max-w-md t-small text-[var(--color-text-muted)]">
          {children}
        </p>
      ) : null}
    </div>
  );
}
