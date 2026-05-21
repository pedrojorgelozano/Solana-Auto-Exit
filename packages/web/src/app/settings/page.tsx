"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { FieldError } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n/context";

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
  const { t } = useT();

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
        eyebrow={t.settings.pageEyebrow}
        title={t.settings.pageTitle}
        description={t.settings.pageDescription}
        back={{ href: "/", label: t.settings.backLabel }}
      />

      {snapshot.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">
          {t.common.loading}
        </p>
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
  const { t } = useT();
  const s = t.settings;
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
    if (!confirm(s.resetPrompt)) return;
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
          {s.networkSection.eyebrow}
        </div>
        <h2 className="mt-3 t-h2">{s.networkSection.title}</h2>

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
            <Label htmlFor="rpcUrl" hint={s.rpc.hint}>
              {s.rpc.label}
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
                  ? s.rpc.mainnetWarning
                  : s.rpc.devnetWarning}
              </p>
              {rpcUrl !== initial.defaultRpcByNetwork[initial.network] ? (
                <button
                  type="button"
                  onClick={() =>
                    setRpcUrl(initial.defaultRpcByNetwork[initial.network])
                  }
                  className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
                >
                  {s.rpc.useDefault(initial.network)}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Defaults */}
      <section className="hairline-t pt-10">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {s.defaultsSection.eyebrow}
        </div>
        <h2 className="mt-3 t-h2">{s.defaultsSection.title}</h2>

        <div className="mt-8 space-y-8">
          <div>
            <Label>{s.slippage.label}</Label>
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
                {s.slippage.legacyStored(slippageBps)}
              </p>
            ) : null}
            <div className="mt-3 max-w-2xl t-small text-[var(--color-text-muted)] space-y-1">
              <p>
                <strong className="text-[var(--color-text)]">0.5%</strong> ·{" "}
                {s.slippage.copy05}
              </p>
              <p>
                <strong className="text-[var(--color-text)]">1%</strong> ·{" "}
                <em>{s.slippage.copy1Recommended}</em>. {s.slippage.copy1}
              </p>
              <p>
                <strong className="text-[var(--color-text)]">2%</strong> ·{" "}
                {s.slippage.copy2}
              </p>
              <p>
                <strong className="text-[var(--color-text)]">5%</strong> ·{" "}
                {s.slippage.copy5} <em>{s.slippage.copy5Must}</em>
                {s.slippage.copy5Rest}
              </p>
              <p className="pt-2">
                <a
                  href="/docs/auto-exit#slippage"
                  className="text-[var(--color-accent-bright)] hover:underline"
                >
                  {s.slippage.docsLink}
                </a>
              </p>
            </div>
          </div>

          <div className="hairline-t pt-8">
            <Label>{s.exitSlippage.label}</Label>
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
                {s.exitSlippage.legacyStored(exitSlippageBps)}
              </p>
            ) : null}
            <p className="mt-3 max-w-2xl t-small text-[var(--color-text-muted)]">
              {s.exitSlippage.copyPart1}
              <strong className="text-[var(--color-text)]">1%</strong>
              {s.exitSlippage.copyPart2}
              <strong className="text-[var(--color-text)]">2%</strong>
              {s.exitSlippage.copyPart3}
            </p>
          </div>

          <div className="hairline-t pt-8">
            <Label>{s.poll.label}</Label>
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
                {s.poll.legacyStored((pollMs / 1000).toFixed(0))}
              </p>
            ) : null}
            <div className="mt-3 max-w-2xl t-small text-[var(--color-text-muted)] space-y-1">
              <p>
                <strong className="text-[var(--color-text)]">10s</strong>
                {s.poll.copy10} <em>{s.poll.copy10Without}</em>
                {s.poll.copy10Rest}
              </p>
              <p>
                <strong className="text-[var(--color-text)]">30s</strong>
                {s.poll.copy30}
                <em>{s.poll.copy30Recommended}</em>
                {s.poll.copy30Rest}
              </p>
              <p>
                <strong className="text-[var(--color-text)]">1 min</strong>
                {s.poll.copy1min}
              </p>
              <p>
                <strong className="text-[var(--color-text)]">5 min</strong>
                {s.poll.copy5min}
              </p>
              <p className="pt-2">
                <a
                  href="/docs/auto-exit#polling-interval"
                  className="text-[var(--color-accent-bright)] hover:underline"
                >
                  {s.poll.docsLink}
                </a>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 t-small text-[var(--color-text-dim)]">
          {s.perTaskNote}
        </p>
      </section>

      {error ? <FieldError>{error}</FieldError> : null}

      {/* Actions */}
      <section className="hairline-t flex flex-wrap items-baseline justify-between gap-4 pt-6">
        <div className="t-small text-[var(--color-text-muted)]">
          {savedAt ? (
            <span className="text-[var(--color-positive)]">
              {t.common.saved}
            </span>
          ) : dirty ? (
            t.common.unsaved
          ) : (
            t.common.allSaved
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={onReset}
            disabled={reset.isPending}
            size="sm"
          >
            {s.resetCta}
          </Button>
          <Button onClick={onSave} disabled={!dirty || update.isPending}>
            {update.isPending ? t.common.saving : t.common.saveChanges}
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
  const { t } = useT();
  const s = t.settings;
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
    if (!confirm(s.switchTestPrompt)) {
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
      <Label>{s.networkLabel}</Label>
      <Segmented
        value={network}
        onChange={(v) => handleChange(v as "devnet" | "mainnet")}
        options={[
          { value: "devnet", label: s.test },
          {
            value: "mainnet",
            label: s.real,
            disabled: !gateAllowed,
            title: gateAllowed ? undefined : s.realLockedDisabled,
          },
        ]}
      />
      <p className="mt-3 t-small text-[var(--color-text-muted)]">
        {network === "mainnet" ? s.realCopy : s.testCopy}
      </p>
      {!gateAllowed ? (
        <p className="mt-2 t-small text-[var(--color-text-dim)]">
          {s.realLocked}{" "}
          <a
            href="/docs/security#mainnet-gate"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            {s.realLockedHow}
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
  const { t } = useT();
  const cr = t.settings.confirmReal;
  const [understood, setUnderstood] = useState(false);
  return (
    <div className="mt-6 border-l-2 border-[var(--color-accent)] bg-[var(--color-accent-dim)] px-5 py-4">
      <div className="t-eyebrow text-[var(--color-accent-bright)]">
        {cr.title}
      </div>
      <p className="mt-2 t-small text-[var(--color-text)]">{cr.body}</p>
      <ul className="mt-3 ml-5 list-disc t-small text-[var(--color-text-muted)] space-y-1">
        <li>
          {cr.bullet1Prefix}
          <em>{cr.bullet1Strong}</em>
          {cr.bullet1Rest}
        </li>
        <li>{cr.bullet2}</li>
        <li>{cr.bullet3}</li>
      </ul>

      <label className="mt-4 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span className="t-small text-[var(--color-text)]">{cr.understood}</span>
      </label>

      <div className="mt-2 ml-7">
        <Link
          href="/docs/disclaimer"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
        >
          {cr.disclaimerLink}
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          {cr.cancel}
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={!understood || pending}
        >
          {pending ? cr.switching : cr.confirmCta}
        </Button>
      </div>
    </div>
  );
}
