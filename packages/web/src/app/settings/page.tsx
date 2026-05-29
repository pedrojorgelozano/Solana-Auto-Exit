"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/Button";
import { TextAction } from "@/components/ui/TextAction";
import { DocsLink } from "@/components/ui/DocsLink";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Input, Label } from "@/components/ui/Input";
import { FieldError } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { trpc } from "@/lib/trpc";
import { formatTrpcError } from "@/lib/trpcError";
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
    <main className="mr-auto max-w-3xl px-6 pb-32 pt-12 fade-in">
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
    lowBalanceThresholdLamports: number;
    updaterAutoCheck: boolean;
    factoryDefaults: {
      network: "devnet" | "mainnet";
      rpcUrl: string;
      slippageBps: number;
      exitSlippageBps: number;
      pollMs: number;
      lowBalanceThresholdLamports: number;
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
  // String input para tolerar typing ("0.", "", etc.); parseado on-save.
  // Convertimos lamports → SOL para mostrar; en save volvemos a lamports.
  const [lowBalanceSol, setLowBalanceSol] = useState<string>(
    lamportsToSolString(initial.lowBalanceThresholdLamports),
  );
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
    setLowBalanceSol(lamportsToSolString(initial.lowBalanceThresholdLamports));
  }, [
    initial.rpcUrl,
    initial.defaultSlippageBps,
    initial.defaultExitSlippageBps,
    initial.defaultPollMs,
    initial.lowBalanceThresholdLamports,
  ]);

  const update = trpc.settings.update.useMutation();
  const reset = trpc.settings.reset.useMutation();

  const parsedLowBalanceLamports = solStringToLamports(lowBalanceSol);
  const lowBalanceValid =
    parsedLowBalanceLamports !== null &&
    parsedLowBalanceLamports >= 0 &&
    parsedLowBalanceLamports <= 5_000_000_000;

  const dirty =
    rpcUrl !== initial.rpcUrl ||
    slippageBps !== initial.defaultSlippageBps ||
    exitSlippageBps !== initial.defaultExitSlippageBps ||
    pollMs !== initial.defaultPollMs ||
    (lowBalanceValid &&
      parsedLowBalanceLamports !== initial.lowBalanceThresholdLamports);

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
      if (
        lowBalanceValid &&
        parsedLowBalanceLamports !== initial.lowBalanceThresholdLamports
      ) {
        ops.push(
          update.mutateAsync({
            key: "lowBalanceThresholdLamports",
            value: parsedLowBalanceLamports,
          }),
        );
      }
      await Promise.all(ops);
      await refresh();
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setError(formatTrpcError(err));
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
    if (!(await confirm(s.resetPrompt))) return;
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
      setLowBalanceSol(
        lamportsToSolString(initial.factoryDefaults.lowBalanceThresholdLamports),
      );
      await refresh();
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setError(formatTrpcError(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Network & RPC */}
      <Panel
        icon={<NetworkIcon />}
        title={s.networkSection.eyebrow}
        description={s.networkSection.title}
      >
        <div className="space-y-6 pt-4">
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
              <div className="max-w-xl space-y-1.5">
                <p className="t-small text-[var(--color-text-dim)]">
                  {initial.network === "mainnet"
                    ? s.rpc.mainnetWarning
                    : s.rpc.devnetWarning}
                </p>
                {initial.network === "mainnet" ? (
                  <p className="t-small text-[var(--color-text-muted)]">
                    {s.rpc.recommendPrefix}
                    <ExternalLink href="https://dashboard.helius.dev/">
                      {s.rpc.recommendLink}
                    </ExternalLink>
                    {s.rpc.recommendSuffix}
                  </p>
                ) : null}
              </div>
              <div className="flex items-baseline gap-4">
                <TestRpcButton url={rpcUrl} />
                {rpcUrl !== initial.defaultRpcByNetwork[initial.network] ? (
                  <TextAction
                    onClick={() =>
                      setRpcUrl(initial.defaultRpcByNetwork[initial.network])
                    }
                  >
                    {s.rpc.useDefault(initial.network)}
                  </TextAction>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Defaults */}
      <Panel
        icon={<DefaultsIcon />}
        title={s.defaultsSection.eyebrow}
        description={s.defaultsSection.title}
      >
        <div className="space-y-8 pt-4">
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
                <DocsLink href="/docs/auto-exit#slippage">
                  {s.slippage.docsLink}
                </DocsLink>
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
                <DocsLink href="/docs/auto-exit#polling-interval">
                  {s.poll.docsLink}
                </DocsLink>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 t-small text-[var(--color-text-dim)]">
          {s.perTaskNote}
        </p>
      </Panel>

      {/* Dashboard threshold */}
      <Panel
        icon={<DashboardIcon />}
        title={t.settings.lowBalance.eyebrow}
        description={t.settings.lowBalance.title}
      >
        <div className="pt-4">
          <Label htmlFor="lowBalance">{t.settings.lowBalance.label}</Label>
          <div className="flex items-baseline gap-3">
            <Input
              id="lowBalance"
              value={lowBalanceSol}
              onChange={(e) => setLowBalanceSol(e.target.value)}
              placeholder="0.05"
              spellCheck={false}
              inputMode="decimal"
              className="t-num max-w-[160px]"
            />
            <span className="t-small text-[var(--color-text-muted)]">
              {t.settings.lowBalance.unit}
            </span>
          </div>
          {!lowBalanceValid && lowBalanceSol.trim() !== "" ? (
            <p className="mt-2 t-small text-[var(--color-warning)]">
              {t.settings.lowBalance.invalid}
            </p>
          ) : null}
          <p className="mt-3 max-w-2xl t-small text-[var(--color-text-muted)]">
            {t.settings.lowBalance.copy}
          </p>
        </div>
      </Panel>

      <UpdaterPanel enabled={initial.updaterAutoCheck} refresh={refresh} />

      {error ? <FieldError>{error}</FieldError> : null}

      {/* Actions */}
      <section className="flex flex-wrap items-baseline justify-between gap-4 px-1 pt-2">
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
          <Button
            onClick={onSave}
            disabled={!dirty || update.isPending || !lowBalanceValid}
          >
            {update.isPending ? t.common.saving : t.common.saveChanges}
          </Button>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// UpdaterPanel — toggle del auto-check de actualizaciones. Standalone: guarda
// al instante (no entra en el dirty-tracking del form). Off por defecto — el
// check es egress a GitHub, así que es opt-in (auditoría / ADR-032).
//
// Solo es funcional dentro del shell Tauri (la app desktop instalada). En
// Docker / pnpm-from-source el plugin `tauri-plugin-updater` no existe, así
// que el toggle sería un no-op engañoso. Detectamos `__TAURI_INTERNALS__` y
// fuera de Tauri renderizamos un panel placeholder que apunta a INSTALL.md
// para la actualización manual. La detección es client-only (`window` no
// existe durante el SSG); el estado `null` inicial evita hydration mismatch.
// ============================================================================

function UpdaterPanel({
  enabled,
  refresh,
}: {
  enabled: boolean;
  refresh: () => Promise<void>;
}) {
  const { t } = useT();
  const s = t.settings.updater;
  const [error, setError] = useState<string | null>(null);
  const [isTauri, setIsTauri] = useState<boolean | null>(null);
  const update = trpc.settings.update.useMutation();

  useEffect(() => {
    setIsTauri(
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
    );
  }, []);

  const onChange = async (next: boolean) => {
    if (next === enabled) return;
    setError(null);
    try {
      await update.mutateAsync({ key: "updaterAutoCheck", value: next });
      await refresh();
    } catch (err) {
      setError(formatTrpcError(err));
    }
  };

  // Antes de hidratar: nada. Evita un flash del panel "wrong" y el
  // hydration mismatch entre SSG (siempre false) y client (true en Tauri).
  if (isTauri === null) return null;

  if (!isTauri) {
    return (
      <Panel icon={<UpdaterIcon />} title={s.eyebrow} description={s.title}>
        <p className="pt-4 max-w-2xl t-small text-[var(--color-text-muted)]">
          {s.notTauriCopy}{" "}
          <ExternalLink href="https://github.com/pedrojorgelozano/Solana-Auto-Exit/blob/main/docs/INSTALL.md">
            {s.notTauriLink}
          </ExternalLink>
        </p>
      </Panel>
    );
  }

  return (
    <Panel icon={<UpdaterIcon />} title={s.eyebrow} description={s.title}>
      <div className="pt-4">
        <Label>{s.label}</Label>
        <Segmented
          value={enabled ? "on" : "off"}
          onChange={(v) => onChange(v === "on")}
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
          ]}
        />
        <p className="mt-3 max-w-2xl t-small text-[var(--color-text-muted)]">
          {s.copy}
        </p>
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </Panel>
  );
}

// ============================================================================
// TestRpcButton — probe del endpoint actual del input (no del persistido).
// Pega `settings.testRpc` con la URL que el user está tipeando; muestra
// version + latencia si OK, o el mensaje del error. El estado vive solo en
// el botón (no en el form) — un test no es "guardar cambios".
// ============================================================================

function TestRpcButton({ url }: { url: string }) {
  const { t } = useT();
  const s = t.settings.rpc;
  const test = trpc.settings.testRpc.useMutation();
  const [result, setResult] = useState<
    | { kind: "ok"; version: string; latencyMs: number }
    | { kind: "error"; message: string }
    | null
  >(null);

  const onClick = async () => {
    setResult(null);
    try {
      const out = await test.mutateAsync({ url });
      setResult({ kind: "ok", version: out.version, latencyMs: out.latencyMs });
    } catch (err) {
      setResult({
        kind: "error",
        message: formatTrpcError(err),
      });
    }
  };

  return (
    <div className="flex items-baseline gap-3">
      <TextAction onClick={onClick} disabled={test.isPending || !url}>
        {test.isPending ? s.testing : s.testCta}
      </TextAction>
      {result?.kind === "ok" ? (
        <span className="t-small text-[var(--color-positive)]">
          {s.testOk(result.version, result.latencyMs)}
        </span>
      ) : null}
      {result?.kind === "error" ? (
        <span className="t-small text-[var(--color-danger)]">
          {s.testFailPrefix}
          {result.message}
        </span>
      ) : null}
    </div>
  );
}

// ============================================================================
// Icons — feather-style 15x15 base (matched to .panel-ic 30px container)
// ============================================================================

function NetworkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function DefaultsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]" aria-hidden="true">
      <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </svg>
  );
}

function UpdaterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 18 0" />
      <path d="M12 12l4-3" />
    </svg>
  );
}

// ============================================================================
// Helpers — SOL ↔ lamports para el input de low balance threshold. Mantenemos
// el state como string (no number) para tolerar typing intermedio ("0.",
// "", ".5") sin re-renderizar valores corruptos. Solo convertimos al save.
// ============================================================================

function lamportsToSolString(lamports: number): string {
  if (!Number.isFinite(lamports) || lamports < 0) return "0";
  // Hasta 9 decimales; quitar trailing zeros para legibilidad.
  return (lamports / 1_000_000_000).toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
}

function solStringToLamports(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  // Math.round es importante — `0.05 * 1e9 = 50000000.00000001` en JS.
  return Math.round(n * 1_000_000_000);
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
    if (!(await confirm(s.switchTestPrompt))) {
      return;
    }
    try {
      await performSwitch("devnet");
    } catch (err) {
      setError(formatTrpcError(err));
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
          <DocsLink href="/docs/security#mainnet-gate">
            {s.realLockedHow}
          </DocsLink>
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
              setError(formatTrpcError(err));
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
