"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { FieldError } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { trpc } from "@/lib/trpc";

// Mismos presets que /positions/[mint] — homogeneidad entre defaults y form.
const SLIPPAGE_PRESETS = [
  { bps: 50, label: "0.5%" },
  { bps: 100, label: "1%" },
  { bps: 200, label: "2%" },
  { bps: 500, label: "5%" },
] as const;

const POLL_PRESETS = [
  { ms: 10_000, label: "10s" },
  { ms: 30_000, label: "30s" },
  { ms: 60_000, label: "1 min" },
  { ms: 300_000, label: "5 min" },
] as const;

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const snapshot = trpc.settings.get.useQuery();

  /**
   * Refetch explícito (no solo invalidate). El invalidate marca stale pero
   * en algunas condiciones no fuerza el refetch inmediato si el componente
   * ya renderizó con la data previa. `refetch()` lo dispara seguro.
   */
  const refresh = async (): Promise<void> => {
    await utils.settings.get.refetch();
  };

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow="Settings"
        title="Defaults for this server."
        description="RPC, slippage and polling defaults pre-fill the auto-exit form. The form lets you override per-task; this is just the starting point."
        back={{ href: "/", label: "Home" }}
      />

      {snapshot.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">Loading…</p>
      ) : snapshot.error ? (
        <p className="t-small text-[var(--color-danger)]">
          {snapshot.error.message}
        </p>
      ) : snapshot.data ? (
        <SettingsForm initial={snapshot.data} refresh={refresh} />
      ) : null}
    </main>
  );
}

function SettingsForm({
  initial,
  refresh,
}: {
  initial: {
    network: "devnet" | "mainnet";
    rpcUrl: string;
    defaultRpcByNetwork: { mainnet: string; devnet: string };
    defaultSlippageBps: number;
    defaultExitSlippageBps: number;
    defaultPollMs: number;
    factoryDefaults: {
      network: "devnet" | "mainnet";
      rpcUrl: string;
      slippageBps: number;
      exitSlippageBps: number;
      pollMs: number;
    };
    mainnetGateAllowed: boolean;
  };
  refresh: () => Promise<void>;
}) {
  const [rpcUrl, setRpcUrl] = useState(initial.rpcUrl);
  const [slippageBps, setSlippageBps] = useState<number>(
    initial.defaultSlippageBps,
  );
  const [exitSlippageBps, setExitSlippageBps] = useState<number>(
    initial.defaultExitSlippageBps,
  );
  const [pollMs, setPollMs] = useState<number>(initial.defaultPollMs);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Sincroniza el local state con el snapshot del servidor. Dependencias
  // explícitas (no el objeto `initial` entero) para que el effect dispare
  // siempre que cualquier campo cambie — caso típico tras un Reset que
  // limpia varios valores a la vez.
  useEffect(() => {
    setRpcUrl(initial.rpcUrl);
    setSlippageBps(initial.defaultSlippageBps);
    setExitSlippageBps(initial.defaultExitSlippageBps);
    setPollMs(initial.defaultPollMs);
  }, [
    initial.rpcUrl,
    initial.defaultSlippageBps,
    initial.defaultExitSlippageBps,
    initial.defaultPollMs,
  ]);

  const update = trpc.settings.update.useMutation();
  const reset = trpc.settings.reset.useMutation();

  const dirty =
    rpcUrl !== initial.rpcUrl ||
    slippageBps !== initial.defaultSlippageBps ||
    exitSlippageBps !== initial.defaultExitSlippageBps ||
    pollMs !== initial.defaultPollMs;

  const onSave = async () => {
    setError(null);
    try {
      // Comparar contra initial y solo enviar las que cambiaron — evita
      // escrituras innecesarias y mantiene el feedback más rápido.
      const ops: Array<Promise<unknown>> = [];
      if (rpcUrl !== initial.rpcUrl) {
        ops.push(update.mutateAsync({ key: "rpcUrl", value: rpcUrl }));
      }
      if (slippageBps !== initial.defaultSlippageBps) {
        ops.push(
          update.mutateAsync({ key: "defaultSlippageBps", value: slippageBps }),
        );
      }
      if (exitSlippageBps !== initial.defaultExitSlippageBps) {
        ops.push(
          update.mutateAsync({
            key: "defaultExitSlippageBps",
            value: exitSlippageBps,
          }),
        );
      }
      if (pollMs !== initial.defaultPollMs) {
        ops.push(update.mutateAsync({ key: "defaultPollMs", value: pollMs }));
      }
      await Promise.all(ops);
      await refresh();
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Si el valor stored no encaja con ningún preset (típicamente un legacy
  // 5_000 ms del default antiguo), no resaltamos ninguna chip — la UI muestra
  // un aviso para que el usuario elija una explícita.
  const pollMatchesPreset = POLL_PRESETS.some((p) => p.ms === pollMs);
  const slippageMatchesPreset = SLIPPAGE_PRESETS.some(
    (p) => p.bps === slippageBps,
  );
  const exitSlippageMatchesPreset = SLIPPAGE_PRESETS.some(
    (p) => p.bps === exitSlippageBps,
  );

  const onReset = async () => {
    if (
      !confirm(
        "Reset RPC URL, slippage and poll interval to defaults?\n\n" +
          "Your network choice (TEST / REAL) is preserved — switch it from the toggle above if you need to.",
      )
    )
      return;
    setError(null);
    try {
      await reset.mutateAsync();
      // Reset imperativo del local state. NO podemos depender del useEffect
      // porque TanStack Query usa structural sharing — si el snapshot tras
      // reset es deep-equal al anterior (caso típico cuando el DB ya estaba
      // en valores default-equivalent), devuelve la misma referencia y el
      // useEffect no dispara. Aplicamos los factory defaults directamente.
      setRpcUrl(initial.factoryDefaults.rpcUrl);
      setSlippageBps(initial.factoryDefaults.slippageBps);
      setExitSlippageBps(initial.factoryDefaults.exitSlippageBps);
      setPollMs(initial.factoryDefaults.pollMs);
      await refresh();
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-14">
      {/* Network & RPC */}
      <section>
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          Network &amp; RPC
        </div>
        <h2 className="mt-3 t-h2">Where this server reads the chain.</h2>

        <div className="mt-8 space-y-6">
          <NetworkPanel
            network={initial.network}
            gateAllowed={initial.mainnetGateAllowed}
            defaultRpcByNetwork={initial.defaultRpcByNetwork}
            currentRpcUrl={rpcUrl}
            setRpcUrl={setRpcUrl}
            refresh={refresh}
          />

          <div>
            <Label htmlFor="rpcUrl" hint="any Solana JSON-RPC endpoint">
              RPC URL
            </Label>
            <Input
              id="rpcUrl"
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              placeholder={initial.defaultRpcByNetwork[initial.network]}
              spellCheck={false}
              className="t-num"
            />
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
              <p className="t-small text-[var(--color-text-dim)] max-w-xl">
                {initial.network === "mainnet"
                  ? "The public mainnet-beta endpoint is heavily rate-limited and not reliable for a watcher. Use Helius, QuickNode, Triton, or a node you run."
                  : "The public devnet endpoint is rate-limited. For sustained use swap to Helius, QuickNode, Triton, or a node you run."}
              </p>
              {rpcUrl !== initial.defaultRpcByNetwork[initial.network] ? (
                <button
                  type="button"
                  onClick={() =>
                    setRpcUrl(initial.defaultRpcByNetwork[initial.network])
                  }
                  className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
                >
                  use {initial.network} default
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Defaults */}
      <section className="hairline-t pt-10">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          Auto-exit defaults
        </div>
        <h2 className="mt-3 t-h2">Pre-filled when you set one up.</h2>

        <div className="mt-8 space-y-8">
          <div>
            <Label>Close slippage</Label>
            <Segmented
              value={String(slippageBps)}
              onChange={(v) => setSlippageBps(Number(v))}
              options={SLIPPAGE_PRESETS.map((p) => ({
                value: String(p.bps),
                label: p.label,
              }))}
            />
            {!slippageMatchesPreset ? (
              <p className="mt-2 t-small text-[var(--color-warning)]">
                Currently stored: {slippageBps} bps. Pick a preset to update.
              </p>
            ) : null}
            <div className="mt-3 max-w-2xl t-small text-[var(--color-text-muted)] space-y-1">
              <p>
                <strong className="text-[var(--color-text)]">0.5%</strong> ·
                tight; reliable only on deep stablecoin pairs (USDC/USDT).
                Triggers may fail to complete in volatile minutes.
              </p>
              <p>
                <strong className="text-[var(--color-text)]">1%</strong> ·{" "}
                <em>recommended default</em>. Works for most pairs in normal
                volatility. Solid balance between protection and reliability.
              </p>
              <p>
                <strong className="text-[var(--color-text)]">2%</strong> · for
                volatile pairs (low-cap, memecoin pools). The price has to
                drift a lot for the close to revert.
              </p>
              <p>
                <strong className="text-[var(--color-text)]">5%</strong> ·
                only when the close <em>must</em> complete. Accepts a high
                price impact tax in exchange for near-zero revert risk.
              </p>
              <p className="pt-2">
                <a
                  href="/docs/auto-exit#slippage"
                  className="text-[var(--color-accent-bright)] hover:underline"
                >
                  → How slippage affects close transactions
                </a>
              </p>
            </div>
          </div>

          <div className="hairline-t pt-8">
            <Label>Exit-swap slippage</Label>
            <Segmented
              value={String(exitSlippageBps)}
              onChange={(v) => setExitSlippageBps(Number(v))}
              options={SLIPPAGE_PRESETS.map((p) => ({
                value: String(p.bps),
                label: p.label,
              }))}
            />
            {!exitSlippageMatchesPreset ? (
              <p className="mt-2 t-small text-[var(--color-warning)]">
                Currently stored: {exitSlippageBps} bps. Pick a preset to
                update.
              </p>
            ) : null}
            <p className="mt-3 max-w-2xl t-small text-[var(--color-text-muted)]">
              Only used when an auto-exit also selects an exit token. Same
              scale as above — same recommendation:{" "}
              <strong className="text-[var(--color-text)]">1%</strong> for
              everyday pairs, <strong className="text-[var(--color-text)]">2%</strong>{" "}
              when the pool is shallow or volatile.
            </p>
          </div>

          <div className="hairline-t pt-8">
            <Label>Poll interval</Label>
            <Segmented
              value={String(pollMs)}
              onChange={(v) => setPollMs(Number(v))}
              options={POLL_PRESETS.map((p) => ({
                value: String(p.ms),
                label: p.label,
              }))}
            />
            {!pollMatchesPreset ? (
              <p className="mt-2 t-small text-[var(--color-warning)]">
                Currently stored: {(pollMs / 1000).toFixed(0)}s. Pick a preset
                to update — the previous default of 5s was too aggressive on
                most RPC providers.
              </p>
            ) : null}
            <div className="mt-3 max-w-2xl t-small text-[var(--color-text-muted)] space-y-1">
              <p>
                <strong className="text-[var(--color-text)]">10s</strong> ·
                fastest reaction. Only worth it for triggers <em>without</em>{" "}
                time buffer and on a paid RPC (8.6k requests/day per task —
                burns Helius free tier in 12 days).
              </p>
              <p>
                <strong className="text-[var(--color-text)]">30s</strong> ·{" "}
                <em>recommended default</em>. Catches every relevant move (LP
                prices don&apos;t jump 5% in 20s) and fits comfortably in
                Helius free tier with a few watchers running.
              </p>
              <p>
                <strong className="text-[var(--color-text)]">1 min</strong> ·
                cheap on RPC. Perfect when you&apos;re using time buffers — the
                hours-long buffer wait dwarfs the polling cadence.
              </p>
              <p>
                <strong className="text-[var(--color-text)]">5 min</strong> ·
                only for very long buffers (days) or stable, slow pools. With
                buffer-less triggers you may miss the cross.
              </p>
              <p className="pt-2">
                <a
                  href="/docs/auto-exit#polling-interval"
                  className="text-[var(--color-accent-bright)] hover:underline"
                >
                  → Polling interval, RPC cost, and buffers
                </a>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 t-small text-[var(--color-text-dim)]">
          Slippage settings above can be overridden per-task on the configure
          form. Poll interval is server-wide; the form does not expose a
          per-task override. Changing a default here only affects new
          auto-exits.
        </p>
      </section>

      {error ? <FieldError>{error}</FieldError> : null}

      {/* Actions */}
      <section className="hairline-t flex flex-wrap items-baseline justify-between gap-4 pt-6">
        <div className="t-small text-[var(--color-text-muted)]">
          {savedAt ? (
            <span className="text-[var(--color-positive)]">Saved.</span>
          ) : dirty ? (
            "Unsaved changes."
          ) : (
            "All saved."
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={onReset}
            disabled={reset.isPending}
            size="sm"
          >
            Reset to defaults
          </Button>
          <Button onClick={onSave} disabled={!dirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// NetworkPanel — toggle TEST | REAL + panel de confirmación cuando se elige
// REAL (gate de ADR-006). REAL queda disabled si ALLOW_MAINNET_LIVE no está.
// ============================================================================

function NetworkPanel({
  network,
  gateAllowed,
  defaultRpcByNetwork,
  currentRpcUrl,
  setRpcUrl,
  refresh,
}: {
  network: "devnet" | "mainnet";
  gateAllowed: boolean;
  defaultRpcByNetwork: { mainnet: string; devnet: string };
  currentRpcUrl: string;
  setRpcUrl: (v: string) => void;
  refresh: () => Promise<void>;
}) {
  const [pendingReal, setPendingReal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = trpc.settings.update.useMutation();

  /**
   * Cambia de red persistiendo network y (cuando aplica) rpcUrl en la misma
   * pasada. Si el rpcUrl actual coincide con el default de la red anterior,
   * lo migramos al default de la nueva red — el usuario no tenía URL custom,
   * así que el swap es transparente. Las dos mutations se persisten antes de
   * refrescar el snapshot para que el useEffect que sincroniza initial → form
   * vea ya el valor correcto y no sobrescriba el cambio local. Si el rpcUrl
   * está customizado, no se toca; la copy del campo y el botón "use X default"
   * le sirven al usuario para revisarlo manualmente.
   */
  const performSwitch = async (next: "devnet" | "mainnet"): Promise<void> => {
    const previousDefault = defaultRpcByNetwork[network];
    const shouldSwapRpc = currentRpcUrl === previousDefault;
    const nextRpc = shouldSwapRpc ? defaultRpcByNetwork[next] : null;

    const ops: Array<Promise<unknown>> = [
      update.mutateAsync({ key: "network", value: next }),
    ];
    if (nextRpc !== null) {
      ops.push(update.mutateAsync({ key: "rpcUrl", value: nextRpc }));
      // Feedback inmediato en el form mientras la mutation viaja.
      setRpcUrl(nextRpc);
    }
    await Promise.all(ops);
    await refresh();
  };

  const handleChange = async (next: "devnet" | "mainnet") => {
    if (next === network) return;
    setError(null);
    if (next === "mainnet") {
      setPendingReal(true);
      return;
    }
    if (
      !confirm(
        "Switch back to test mode? New auto-exits will run on Solana devnet.",
      )
    ) {
      return;
    }
    try {
      await performSwitch("devnet");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <Label>Network</Label>
      <Segmented
        value={network}
        onChange={(v) => handleChange(v as "devnet" | "mainnet")}
        options={[
          { value: "devnet", label: "TEST" },
          {
            value: "mainnet",
            label: "REAL",
            disabled: !gateAllowed,
            title: gateAllowed
              ? undefined
              : "Locked — enable in server environment",
          },
        ]}
      />
      <p className="mt-3 t-small text-[var(--color-text-muted)]">
        {network === "mainnet"
          ? "Real mode — auto-exits sign on Solana mainnet with real funds."
          : "Test mode — auto-exits run on Solana devnet. No real funds at risk."}
      </p>
      {!gateAllowed ? (
        <p className="mt-2 t-small text-[var(--color-text-dim)]">
          Real mode is locked on this server.{" "}
          <a
            href="/docs/security#mainnet-gate"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            → How to enable it
          </a>
        </p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}

      {pendingReal ? (
        <ConfirmRealPanel
          onConfirm={async () => {
            setError(null);
            try {
              await performSwitch("mainnet");
              setPendingReal(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
          onCancel={() => {
            setPendingReal(false);
            setError(null);
          }}
          pending={update.isPending}
        />
      ) : null}
    </div>
  );
}

/**
 * Confirmación de switch a REAL — segundo paso de la safety net de ADR-006.
 * El primer paso es el env-var ALLOW_MAINNET_LIVE (gate del server). Aquí
 * exigimos checkbox de "entiendo" + recordatorios de qué cambia.
 */
function ConfirmRealPanel({
  onConfirm,
  onCancel,
  pending,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [understood, setUnderstood] = useState(false);
  return (
    <div className="mt-6 border-l-2 border-[var(--color-accent)] bg-[var(--color-accent-dim)] px-5 py-4">
      <div className="t-eyebrow text-[var(--color-accent-bright)]">
        Confirm switch to real mode
      </div>
      <p className="mt-2 t-small text-[var(--color-text)]">
        Every auto-exit you create after this will sign transactions on
        Solana mainnet with real funds. Close transactions cost real SOL;
        price moves affect real money. There is no undo on a triggered
        close.
      </p>
      <ul className="mt-3 ml-5 list-disc t-small text-[var(--color-text-muted)] space-y-1">
        <li>
          Update <em>RPC URL</em> below to a mainnet endpoint (Helius,
          QuickNode, Triton, or your own node). The public devnet URL
          won&apos;t work.
        </li>
        <li>
          Existing tasks keep their original network — they don&apos;t
          auto-migrate. Only new auto-exits will be on mainnet.
        </li>
        <li>
          Re-test your strategy on devnet before flipping the switch.
        </li>
      </ul>

      <label className="mt-4 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span className="t-small text-[var(--color-text)]">
          I understand this will sign transactions with real funds and
          I&apos;ve updated my RPC URL.
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={!understood || pending}
        >
          {pending ? "Switching…" : "Confirm · use real funds"}
        </Button>
      </div>
    </div>
  );
}
