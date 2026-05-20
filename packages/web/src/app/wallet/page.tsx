"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardLabel, FieldError } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";

type SourceType = "base58" | "jsonArray";

export default function WalletPage() {
  const utils = trpc.useUtils();
  const status = trpc.wallet.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <PageHeader
        title="Wallet"
        description="Encrypted in-server. The key is decrypted only in memory while the vault is unlocked."
        back={{ href: "/", label: "Home" }}
      />

      {status.isLoading ? (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">Loading status…</p>
        </Card>
      ) : status.error ? (
        <Card variant="danger">
          <p className="text-sm text-[var(--color-danger)]">
            Cannot reach the backend: {status.error.message}
          </p>
        </Card>
      ) : !status.data ? null : (
        <VaultPanel
          state={status.data}
          refresh={() => utils.wallet.status.invalidate()}
        />
      )}
    </main>
  );
}

// ============================================================================
// State panel — routes to the right form/actions
// ============================================================================

function VaultPanel({
  state,
  refresh,
}: {
  state: { hasVault: boolean; unlocked: boolean; address: string | null };
  refresh: () => void;
}) {
  if (!state.hasVault) return <CreateForm refresh={refresh} />;
  if (!state.unlocked)
    return <UnlockForm address={state.address} refresh={refresh} />;
  return <UnlockedPanel address={state.address!} refresh={refresh} />;
}

// ============================================================================
// 1. No vault yet → create
// ============================================================================

function CreateForm({ refresh }: { refresh: () => void }) {
  const [sourceType, setSourceType] = useState<SourceType>("base58");
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.wallet.create.useMutation();
  const unlock = trpc.wallet.unlock.useMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters.");
      return;
    }
    if (passphrase !== confirm) {
      setError("Passphrases don't match.");
      return;
    }
    try {
      await create.mutateAsync({
        passphrase,
        source: { type: sourceType, value: secret },
      });
      // Auto-unlock so the user lands in the "unlocked" state in one step.
      await unlock.mutateAsync({ passphrase });
      setSecret("");
      setPassphrase("");
      setConfirm("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const busy = create.isPending || unlock.isPending;

  return (
    <Card>
      <CardLabel>Create vault</CardLabel>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Paste your Solana secret key. It will be encrypted at rest with your
        passphrase (scrypt + AES-256-GCM) and only decrypted in memory while
        you keep the vault unlocked.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div>
          <Label>Secret key format</Label>
          <div className="flex gap-2">
            <FormatOption
              label="Base58 (Phantom/Backpack)"
              active={sourceType === "base58"}
              onClick={() => setSourceType("base58")}
            />
            <FormatOption
              label="JSON array (Solana CLI)"
              active={sourceType === "jsonArray"}
              onClick={() => setSourceType("jsonArray")}
            />
          </div>
        </div>

        <div>
          <Label
            htmlFor="secret"
            hint={
              sourceType === "base58"
                ? "88-char base58 string"
                : "[12, 34, 56, …]  (64 integers)"
            }
          >
            Secret key
          </Label>
          {sourceType === "base58" ? (
            <Input
              id="secret"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="3suF5rw3…"
              required
            />
          ) : (
            <Textarea
              id="secret"
              rows={4}
              autoComplete="off"
              spellCheck={false}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="[12, 45, 200, …, 8]"
              required
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="passphrase">Passphrase</Label>
            <Input
              id="passphrase"
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
        </div>

        {error ? <FieldError>{error}</FieldError> : null}

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create vault"}
          </Button>
        </div>
      </form>

      <hr className="my-6 border-[var(--color-border)]" />
      <p className="text-xs text-[var(--color-text-muted)]">
        Recommended: use a <strong>dedicated bot wallet</strong> with only the
        funds you want the bot to manage. If this machine is compromised, the
        blast radius is limited.
      </p>
    </Card>
  );
}

function FormatOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]"
          : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// 2. Vault exists but locked → unlock
// ============================================================================

function UnlockForm({
  address,
  refresh,
}: {
  address: string | null;
  refresh: () => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unlock = trpc.wallet.unlock.useMutation();
  const del = trpc.wallet.delete.useMutation();

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

  const deleteVault = async () => {
    if (
      !confirm(
        "Delete the encrypted vault from disk? This is irreversible. The wallet itself is not affected.",
      )
    )
      return;
    await del.mutateAsync();
    refresh();
  };

  return (
    <Card>
      <CardLabel>Locked vault</CardLabel>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Address:{" "}
        <code className="text-[var(--color-text)]">{address ?? "(unknown)"}</code>
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
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
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={deleteVault}
            disabled={del.isPending}
          >
            Delete vault
          </Button>
          <Button type="submit" disabled={unlock.isPending}>
            {unlock.isPending ? "Unlocking…" : "Unlock"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ============================================================================
// 3. Unlocked → show actions
// ============================================================================

function UnlockedPanel({
  address,
  refresh,
}: {
  address: string;
  refresh: () => void;
}) {
  const lock = trpc.wallet.lock.useMutation();
  const del = trpc.wallet.delete.useMutation();

  const onLock = async () => {
    await lock.mutateAsync();
    refresh();
  };

  const onDelete = async () => {
    if (
      !confirm(
        "Delete the encrypted vault from disk? This is irreversible. The wallet itself is not affected.",
      )
    )
      return;
    await del.mutateAsync();
    refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardLabel>Vault unlocked</CardLabel>
            <p className="mt-2 break-all font-mono text-sm text-[var(--color-text)]">
              {address}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              The keypair is in memory. It will be used to sign close + swap
              transactions for armed tasks. Lock when done.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-3 py-1 text-xs text-[var(--color-success)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
            unlocked
          </span>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onLock} disabled={lock.isPending}>
            {lock.isPending ? "Locking…" : "Lock"}
          </Button>
        </div>
      </Card>

      <Card variant="danger">
        <CardLabel>Danger zone</CardLabel>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Delete the encrypted vault file from disk. The wallet itself is not
          touched (it lives only on-chain). You'll need to re-create the vault
          to operate this server again.
        </p>
        <div className="mt-4 flex items-center justify-end">
          <Button variant="danger" onClick={onDelete} disabled={del.isPending}>
            {del.isPending ? "Deleting…" : "Delete vault"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
