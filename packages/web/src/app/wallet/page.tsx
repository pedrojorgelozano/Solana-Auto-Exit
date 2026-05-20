"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { FieldError } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/format";

type SourceType = "base58" | "jsonArray";

export default function WalletPage() {
  const utils = trpc.useUtils();
  const status = trpc.wallet.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-12">
      <PageHeader
        eyebrow="Wallet"
        title="The keypair that signs your closes."
        description="Encrypted at rest with scrypt + AES-256-GCM. Decrypted in memory only while the vault is unlocked."
        back={{ href: "/", label: "Home" }}
      />

      {status.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">
          Loading vault status…
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
  if (!state.hasVault) return <Onboard refresh={refresh} />;
  if (!state.unlocked) return <UnlockSection address={state.address} refresh={refresh} />;
  return <UnlockedSection address={state.address!} refresh={refresh} />;
}

// ============================================================================
// 1. No vault yet → onboarding
// ============================================================================

function Onboard({ refresh }: { refresh: () => void }) {
  const [sourceType, setSourceType] = useState<SourceType>("base58");
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.wallet.create.useMutation();
  const unlock = trpc.wallet.unlock.useMutation();
  const busy = create.isPending || unlock.isPending;

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
      await unlock.mutateAsync({ passphrase });
      setSecret("");
      setPassphrase("");
      setConfirm("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-12">
      <Recommendation />

      <form onSubmit={submit} className="space-y-10">
        <fieldset className="hairline-t pt-8">
          <legend className="t-eyebrow mb-4">1 — Paste the secret key</legend>

          <Segmented
            value={sourceType}
            onChange={(v) => setSourceType(v)}
            options={[
              { value: "base58", label: "Base58 — Phantom / Backpack" },
              { value: "jsonArray", label: "JSON array — Solana CLI" },
            ]}
          />

          <div className="mt-6">
            <Label
              htmlFor="secret"
              hint={
                sourceType === "base58"
                  ? "≈ 88 base58 characters"
                  : "[12, 34, 56, …]  · 64 integers"
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
                className="t-num"
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
        </fieldset>

        <fieldset className="hairline-t pt-8">
          <legend className="t-eyebrow mb-4">2 — Pick a passphrase</legend>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="passphrase" hint="≥ 8 characters">
                Passphrase
              </Label>
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
        </fieldset>

        {error ? <FieldError>{error}</FieldError> : null}

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Encrypting…" : "Encrypt and unlock"}
          </Button>
        </div>
      </form>
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
          Vault is locked
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
          Vault unlocked
        </div>
        <h2 className="mt-3 t-h2 break-all t-num">{address}</h2>
        <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
          The keypair is in memory. It will be used to sign close and swap
          transactions for armed tasks. Lock when you&apos;re done.
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
// Danger zone (compartido)
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
      ? "Permanently delete the encrypted vault file. The wallet itself is not affected — it lives on-chain — but the server forgets it."
      : "If you don't remember the passphrase, deleting the vault is the only way out. The wallet itself stays safe on-chain; you just lose this server's encrypted copy.";

  return (
    <section className="hairline-t pt-8">
      <div className="t-eyebrow text-[var(--color-danger)]">Danger zone</div>
      <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
        {explanation}
      </p>

      {confirmingDelete ? (
        <div className="mt-6 flex items-center gap-3">
          <span className="t-small text-[var(--color-danger)]">
            Delete the encrypted vault file?
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
            Delete vault
          </Button>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Segmented control
// ============================================================================

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex border border-[var(--color-hairline)] rounded-[2px]">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 t-eyebrow transition-colors ${
              active
                ? "bg-[var(--color-accent-dim)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
