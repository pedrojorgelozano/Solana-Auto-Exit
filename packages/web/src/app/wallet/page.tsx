"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { FieldError } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, PasswordInput } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { useConnectWallet } from "@/lib/connect-wallet";
import { truncateAddress } from "@/lib/format";
import { useT } from "@/i18n/context";

export default function WalletPage() {
  const utils = trpc.useUtils();
  const { t } = useT();
  const w = t.wallet;
  const status = trpc.wallet.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  return (
    <main className="mr-auto max-w-3xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow={w.pageEyebrow}
        title={w.pageTitle}
        description={w.pageDescription}
        back={{ href: "/", label: w.backLabel }}
      />

      <div className="-mt-6 mb-10">
        <Link
          href="/docs/security"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          {w.encryptionLink}
        </Link>
      </div>

      {status.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">{w.loading}</p>
      ) : status.error ? (
        <p className="t-small text-[var(--color-danger)]">
          {w.backendError(status.error.message)}
        </p>
      ) : !status.data ? null : (
        <Panel
          state={status.data}
          refresh={() => utils.wallet.status.invalidate()}
        />
      )}
    </main>
  );
}

function Panel({
  state,
  refresh,
}: {
  state: { hasVault: boolean; unlocked: boolean; address: string | null };
  refresh: () => void;
}) {
  if (!state.hasVault) return <ConnectCta />;
  if (!state.unlocked) return <UnlockSection address={state.address} refresh={refresh} />;
  return <UnlockedSection address={state.address!} refresh={refresh} />;
}

// ============================================================================
// 1. No vault → CTA al modal
// ============================================================================

function ConnectCta() {
  const connect = useConnectWallet();
  const { t } = useT();
  const w = t.wallet;
  return (
    <div className="space-y-10">
      <Recommendation />

      <section className="hairline-t pt-10">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {w.noVault.eyebrow}
        </div>
        <h2 className="mt-3 t-h2">{w.noVault.title}</h2>
        <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
          {w.noVault.body}
        </p>
        <div className="mt-6 flex flex-wrap items-baseline gap-4">
          <Button onClick={connect.open}>{w.noVault.cta}</Button>
          <Link
            href="/docs/bot-wallet"
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
          >
            {w.noVault.docs}
          </Link>
        </div>
      </section>
    </div>
  );
}

function Recommendation() {
  const { t } = useT();
  return (
    <aside className="border-l-2 border-[var(--color-accent)] pl-5">
      <div className="t-eyebrow text-[var(--color-accent-bright)]">
        {t.wallet.scope.eyebrow}
      </div>
      <p className="mt-2 max-w-xl t-body text-[var(--color-text)]">
        {t.wallet.scope.body}
      </p>
    </aside>
  );
}

// ============================================================================
// 2. Vault exists but locked → unlock
// ============================================================================

function UnlockSection({
  address,
  refresh,
}: {
  address: string | null;
  refresh: () => void;
}) {
  const { t } = useT();
  const l = t.wallet.locked;
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unlock = trpc.wallet.unlock.useMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await unlock.mutateAsync({ passphrase });
      setPassphrase("");
      refresh();
      // Post-unlock UX: el wallet sigue mostrándose en el sidebar; mandamos
      // al user al dashboard, que es donde está la lista de posiciones +
      // auto-exits (el siguiente paso lógico). La página /wallet sigue
      // siendo navegable para gestionar la cuenta (lock/delete) cuando
      // haga falta.
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-12">
      <section>
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {l.eyebrow}
        </div>
        <p className="mt-3 max-w-lg t-body text-[var(--color-text-muted)]">
          {address
            ? l.bodyWithAddress(truncateAddress(address, 6, 6))
            : l.bodyNoAddress}
        </p>

        <form onSubmit={submit} className="mt-8 max-w-md space-y-6">
          <div>
            <Label htmlFor="passphrase">{l.passphraseLabel}</Label>
            <PasswordInput
              id="passphrase"
              autoComplete="current-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
            />
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <div className="flex items-center justify-end">
            <Button type="submit" disabled={unlock.isPending}>
              {unlock.isPending ? l.unlocking : l.unlock}
            </Button>
          </div>
        </form>
      </section>

      <DangerZone reason="lost-passphrase" refresh={refresh} />
    </div>
  );
}

// ============================================================================
// 3. Unlocked → status + lock + danger zone
// ============================================================================

function UnlockedSection({
  address,
  refresh,
}: {
  address: string;
  refresh: () => void;
}) {
  const { t } = useT();
  const u = t.wallet.unlocked;
  const lock = trpc.wallet.lock.useMutation();

  const onLock = async () => {
    await lock.mutateAsync();
    refresh();
  };

  return (
    <div className="space-y-12">
      <section>
        <div className="t-eyebrow text-[var(--color-positive)]">
          {u.eyebrow}
        </div>
        <h2 className="mt-3 t-h2 break-all t-num">{address}</h2>
        <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
          {u.body}
        </p>
      </section>

      {/* Lock panel — antes vivía en el sidebar. Lockear pausa todos los
          auto-exits y rompe el use case 'set and forget', por eso lo
          reubicamos aquí con explicación clara de las consecuencias. */}
      <section className="border-l-2 border-[var(--color-warning)] pl-5">
        <div className="t-eyebrow text-[var(--color-warning)]">
          {u.lockEyebrow}
        </div>
        <h3 className="mt-3 t-h2">{u.lockTitle}</h3>
        <div className="mt-4 max-w-xl space-y-3 t-body text-[var(--color-text-muted)]">
          <p>{u.lockExplainP1}</p>
          <p>
            <strong className="text-[var(--color-text)]">
              {u.lockExplainP2.split(". ")[0]}.
            </strong>{" "}
            {u.lockExplainP2.split(". ").slice(1).join(". ")}
          </p>
        </div>
        <div className="mt-6 flex items-baseline justify-between gap-4 flex-wrap">
          <Link
            href="/docs/security#hot-wallet-tradeoff"
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
          >
            {u.lockExplainTradeoff}
          </Link>
          <Button variant="secondary" onClick={onLock} disabled={lock.isPending}>
            {lock.isPending ? u.locking : u.lockButton}
          </Button>
        </div>
      </section>

      <DangerZone reason="reset" refresh={refresh} />
    </div>
  );
}

// ============================================================================
// Danger zone
// ============================================================================

function DangerZone({
  reason,
  refresh,
}: {
  reason: "reset" | "lost-passphrase";
  refresh: () => void;
}) {
  const { t } = useT();
  const d = t.wallet.danger;
  const del = trpc.wallet.delete.useMutation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const onDelete = async () => {
    await del.mutateAsync();
    setConfirmingDelete(false);
    refresh();
  };

  const explanation =
    reason === "reset" ? d.explainReset : d.explainLostPass;

  return (
    <section className="hairline-t pt-8">
      <div className="flex items-baseline justify-between gap-3">
        <div className="t-eyebrow text-[var(--color-danger)]">{d.eyebrow}</div>
        <Link
          href="/docs/bot-wallet#deleting-the-wallet"
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          {d.docsLink}
        </Link>
      </div>
      <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
        {explanation}
      </p>

      {confirmingDelete ? (
        <div className="mt-6 flex items-center gap-3">
          <span className="t-small text-[var(--color-danger)]">
            {d.confirmDelete}
          </span>
          <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
            {d.cancel}
          </Button>
          <Button variant="danger" onClick={onDelete} disabled={del.isPending}>
            {del.isPending ? t.common.deleting : d.yesDelete}
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex items-center justify-end">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
          >
            {d.deleteCta}
          </Button>
        </div>
      )}
    </section>
  );
}
