"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { FieldError } from "@/components/ui/Card";
import { trpc } from "@/lib/trpc";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const snapshot = trpc.settings.get.useQuery();

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
        <SettingsForm
          initial={snapshot.data}
          refresh={() => utils.settings.get.invalidate()}
        />
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
    defaultSlippageBps: number;
    defaultExitSlippageBps: number;
    defaultPollMs: number;
  };
  refresh: () => void;
}) {
  const [rpcUrl, setRpcUrl] = useState(initial.rpcUrl);
  const [slippage, setSlippage] = useState(String(initial.defaultSlippageBps));
  const [exitSlippage, setExitSlippage] = useState(
    String(initial.defaultExitSlippageBps),
  );
  const [pollMs, setPollMs] = useState(String(initial.defaultPollMs));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Si el backend cambia (otra pestaña edita) re-sincronizamos.
  useEffect(() => {
    setRpcUrl(initial.rpcUrl);
    setSlippage(String(initial.defaultSlippageBps));
    setExitSlippage(String(initial.defaultExitSlippageBps));
    setPollMs(String(initial.defaultPollMs));
  }, [initial]);

  const update = trpc.settings.update.useMutation();
  const reset = trpc.settings.reset.useMutation();

  const dirty =
    rpcUrl !== initial.rpcUrl ||
    slippage !== String(initial.defaultSlippageBps) ||
    exitSlippage !== String(initial.defaultExitSlippageBps) ||
    pollMs !== String(initial.defaultPollMs);

  const onSave = async () => {
    setError(null);
    const slippageN = Number.parseInt(slippage, 10);
    const exitSlippageN = Number.parseInt(exitSlippage, 10);
    const pollN = Number.parseInt(pollMs, 10);
    if (
      !Number.isFinite(slippageN) ||
      slippageN < 0 ||
      slippageN > 10_000
    ) {
      setError("Default slippage must be an integer between 0 and 10000.");
      return;
    }
    if (
      !Number.isFinite(exitSlippageN) ||
      exitSlippageN < 0 ||
      exitSlippageN > 10_000
    ) {
      setError("Exit slippage must be an integer between 0 and 10000.");
      return;
    }
    if (!Number.isFinite(pollN) || pollN < 1_000 || pollN > 600_000) {
      setError("Poll interval must be between 1000 and 600000 ms.");
      return;
    }
    try {
      // Comparar contra initial y solo enviar las que cambiaron — evita
      // escrituras innecesarias y mantiene el feedback más rápido.
      const ops: Array<Promise<unknown>> = [];
      if (rpcUrl !== initial.rpcUrl) {
        ops.push(update.mutateAsync({ key: "rpcUrl", value: rpcUrl }));
      }
      if (slippageN !== initial.defaultSlippageBps) {
        ops.push(
          update.mutateAsync({ key: "defaultSlippageBps", value: slippageN }),
        );
      }
      if (exitSlippageN !== initial.defaultExitSlippageBps) {
        ops.push(
          update.mutateAsync({
            key: "defaultExitSlippageBps",
            value: exitSlippageN,
          }),
        );
      }
      if (pollN !== initial.defaultPollMs) {
        ops.push(update.mutateAsync({ key: "defaultPollMs", value: pollN }));
      }
      await Promise.all(ops);
      refresh();
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onReset = async () => {
    if (!confirm("Reset all settings to their defaults?")) return;
    await reset.mutateAsync();
    refresh();
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
          <div>
            <Label htmlFor="network">Network</Label>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="t-num text-[var(--color-text)]">devnet</span>
              <span className="t-eyebrow text-[var(--color-text-dim)]">
                · mainnet locked until F4
              </span>
            </div>
            <p className="mt-2 t-small text-[var(--color-text-dim)]">
              Mainnet access requires the production gate from ADR-006 plus a
              visual audit before public release.
            </p>
          </div>

          <div>
            <Label htmlFor="rpcUrl" hint="any Solana JSON-RPC endpoint">
              RPC URL
            </Label>
            <Input
              id="rpcUrl"
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              placeholder="https://api.devnet.solana.com"
              spellCheck={false}
              className="t-num"
            />
            <p className="mt-2 t-small text-[var(--color-text-dim)]">
              The public devnet endpoint is rate-limited. For sustained use
              swap to Helius, QuickNode, Triton, or a node you run.
            </p>
          </div>
        </div>
      </section>

      {/* Defaults */}
      <section className="hairline-t pt-10">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          Auto-exit defaults
        </div>
        <h2 className="mt-3 t-h2">Pre-filled when you set one up.</h2>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <Label htmlFor="slippage" hint="basis points · 100 = 1%">
              Close slippage
            </Label>
            <Input
              id="slippage"
              type="number"
              min={0}
              max={10000}
              step={10}
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="t-num"
            />
          </div>
          <div>
            <Label htmlFor="exitSlippage" hint="for the exit-token swap">
              Exit-swap slippage
            </Label>
            <Input
              id="exitSlippage"
              type="number"
              min={0}
              max={10000}
              step={10}
              value={exitSlippage}
              onChange={(e) => setExitSlippage(e.target.value)}
              className="t-num"
            />
          </div>
          <div>
            <Label htmlFor="pollMs" hint="ms · how often to re-read price">
              Poll interval
            </Label>
            <Input
              id="pollMs"
              type="number"
              min={1000}
              max={600000}
              step={1000}
              value={pollMs}
              onChange={(e) => setPollMs(e.target.value)}
              className="t-num"
            />
          </div>
        </div>

        <p className="mt-6 t-small text-[var(--color-text-dim)]">
          You can still override these per-task on the configure form. Changing
          a default here only affects new auto-exits.
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
