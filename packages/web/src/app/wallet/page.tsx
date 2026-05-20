"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { FieldError } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { useConnectWallet } from "@/lib/connect-wallet";
import { truncateAddress } from "@/lib/format";

export default function WalletPage() {
  const utils = trpc.useUtils();
  const status = trpc.wallet.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow="Wallet"
        title="The keypair that signs your closes."
        description="Encrypted at rest with scrypt + AES-256-GCM. Decrypted in memory only while the wallet is unlocked."
        back={{ href: "/", label: "Home" }}
      />

      {status.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">
          Loading wallet status…
        </p>
      ) : status.error ? (
        <p className="t-small text-[var(--color-danger)]">
          Cannot reach the backend: {status.error.message}
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
  return (
    <div className="space-y-10">
      <Recommendation />

      <section className="hairline-t pt-10">
        <div className="t-eyebrow text-[var(--color-text-muted)]">No wallet</div>
        <h2 className="mt-3 t-h2">Connect your bot wallet to begin.</h2>
        <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
          Generate a fresh one (recommended) or import an existing key. The
          server encrypts it with a passphrase and uses it only to sign the
          closes you configure.
        </p>
        <div className="mt-6">
          <Button onClick={connect.open}>Connect bot wallet →</Button>
        </div>
      </section>
    </div>
  );
}

function Recommendation() {
  return (
    <aside className="border-l-2 border-[var(--color-accent)] pl-5">
      <div className="t-eyebrow text-[var(--color-accent-bright)]">
        Recommended
      </div>
      <p className="mt-2 max-w-xl t-body text-[var(--color-text)]">
        Use a <em>dedicated bot wallet</em>, not your main one. Move only the
        funds you want this server to manage. If your machine is compromised,
        the blast radius stays small.
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-12">
      <section>
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          Wallet is locked
        </div>
        <p className="mt-3 max-w-lg t-body text-[var(--color-text-muted)]">
          A keypair is encrypted on disk
          {address ? (
            <>
              {" "}
              for{" "}
              <span className="t-num text-[var(--color-text)]">
                {truncateAddress(address, 6, 6)}
              </span>
              .
            </>
          ) : (
            "."
          )}{" "}
          Enter the passphrase to load it into memory.
        </p>

        <form onSubmit={submit} className="mt-8 max-w-md space-y-6">
          <div>
            <Label htmlFor="passphrase">Passphrase</Label>
            <Input
              id="passphrase"
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
            />
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <div className="flex items-center justify-end">
            <Button type="submit" disabled={unlock.isPending}>
              {unlock.isPending ? "Unlocking…" : "Unlock"}
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
  const lock = trpc.wallet.lock.useMutation();

  const onLock = async () => {
    await lock.mutateAsync();
    refresh();
  };

  return (
    <div className="space-y-12">
      <section>
        <div className="t-eyebrow text-[var(--color-positive)]">
          Wallet unlocked
        </div>
        <h2 className="mt-3 t-h2 break-all t-num">{address}</h2>
        <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
          The keypair is in memory. It will be used to sign close and swap
          transactions for armed auto-exits. Lock when you&apos;re done.
        </p>
        <div className="mt-6 flex items-center justify-end">
          <Button variant="secondary" onClick={onLock} disabled={lock.isPending}>
            {lock.isPending ? "Locking…" : "Lock"}
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
  const del = trpc.wallet.delete.useMutation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const onDelete = async () => {
    await del.mutateAsync();
    setConfirmingDelete(false);
    refresh();
  };

  const explanation =
    reason === "reset"
      ? "Permanently delete the encrypted wallet file. The wallet on-chain is not affected — only this server's encrypted copy is removed."
      : "If you don't remember the passphrase, deleting the encrypted file is the only way out. The wallet on-chain stays safe; you just lose this server's encrypted copy.";

  return (
    <section className="hairline-t pt-8">
      <div className="t-eyebrow text-[var(--color-danger)]">Danger zone</div>
      <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
        {explanation}
      </p>

      {confirmingDelete ? (
        <div className="mt-6 flex items-center gap-3">
          <span className="t-small text-[var(--color-danger)]">
            Delete the encrypted wallet file?
          </span>
          <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onDelete} disabled={del.isPending}>
            {del.isPending ? "Deleting…" : "Yes, delete"}
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex items-center justify-end">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete wallet
          </Button>
        </div>
      )}
    </section>
  );
}
