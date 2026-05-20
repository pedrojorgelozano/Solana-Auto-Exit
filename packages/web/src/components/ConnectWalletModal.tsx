"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Input";
import { FieldError } from "@/components/ui/Card";
import { trpc } from "@/lib/trpc";
import { useConnectWallet } from "@/lib/connect-wallet";
import { truncateAddress } from "@/lib/format";

type Tab = "generate" | "base58" | "json";

export function ConnectWalletModal() {
  const { isOpen, close } = useConnectWallet();

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 fade-in"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
        onClick={close}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl border border-[var(--color-rule)] bg-[var(--color-bg-elevated)] grain-overlay">
        <ModalContent />
      </div>
    </div>
  );
}

function ModalContent() {
  const { close } = useConnectWallet();
  const [tab, setTab] = useState<Tab>("generate");
  // Cuando una mutation acaba bien, mostramos el "success" — para generate
  // mostramos también el secret.
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [generatedAddress, setGeneratedAddress] = useState<string | null>(null);

  // Si estamos en success state, ocupa toda la pantalla del modal.
  if (generatedSecret && generatedAddress) {
    return (
      <GenerateSuccess
        address={generatedAddress}
        secretBase58={generatedSecret}
        onDone={close}
      />
    );
  }

  return (
    <>
      <ModalHeader title="Connect bot wallet" onClose={close} />

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-hairline)]">
        <TabButton active={tab === "generate"} onClick={() => setTab("generate")}>
          Generate new
          <span className="ml-2 inline-flex items-center rounded-[2px] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--color-accent-bright)]">
            recommended
          </span>
        </TabButton>
        <TabButton active={tab === "base58"} onClick={() => setTab("base58")}>
          Import · base58
        </TabButton>
        <TabButton active={tab === "json"} onClick={() => setTab("json")}>
          Import · JSON
        </TabButton>
      </div>

      <div className="p-8">
        {tab === "generate" ? (
          <GenerateTab
            onSuccess={(addr, secret) => {
              setGeneratedAddress(addr);
              setGeneratedSecret(secret);
            }}
          />
        ) : tab === "base58" ? (
          <ImportTab kind="base58" onSuccess={close} />
        ) : (
          <ImportTab kind="jsonArray" onSuccess={close} />
        )}
      </div>
    </>
  );
}

// ============================================================================
// Header + tab buttons
// ============================================================================

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between p-6 border-b border-[var(--color-hairline)]">
      <div>
        <div className="t-eyebrow text-[var(--color-accent-bright)]">Wallet</div>
        <h2 className="mt-1 t-h2">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="h-9 w-9 inline-flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1 L13 13 M13 1 L1 13"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      </button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-3 t-eyebrow transition-colors ${
        active
          ? "text-[var(--color-text)] bg-[var(--color-accent-dim)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Generate tab
// ============================================================================

function GenerateTab({
  onSuccess,
}: {
  onSuccess: (address: string, secret: string) => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const gen = trpc.wallet.generate.useMutation({
    onSuccess: (data) => {
      utils.wallet.status.invalidate();
      onSuccess(data.address, data.secretBase58);
    },
  });

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
      await gen.mutateAsync({ passphrase });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="t-body text-[var(--color-text-muted)]">
        We generate a fresh Solana keypair right here on the server. You&apos;ll
        see the secret <strong>once</strong> — save it in your password
        manager. We can&apos;t recover it later.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="gen-passphrase" hint="≥ 8 characters">
            Passphrase
          </Label>
          <Input
            id="gen-passphrase"
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <Label htmlFor="gen-confirm">Confirm</Label>
          <Input
            id="gen-confirm"
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

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" disabled={gen.isPending}>
          {gen.isPending ? "Generating…" : "Generate and encrypt"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Import tab (shared para base58 + json)
// ============================================================================

function ImportTab({
  kind,
  onSuccess,
}: {
  kind: "base58" | "jsonArray";
  onSuccess: () => void;
}) {
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

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
        source: { type: kind, value: secret },
      });
      await unlock.mutateAsync({ passphrase });
      await utils.wallet.status.invalidate();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const busy = create.isPending || unlock.isPending;

  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="t-body text-[var(--color-text-muted)]">
        {kind === "base58"
          ? "Paste the secret key in base58 form. This is what Phantom and Backpack show when you export a private key (≈ 88 characters)."
          : "Paste the wallet.json contents from the Solana CLI — a JSON array of 64 integers, e.g. [12, 45, 200, …]."}
      </p>

      <div>
        <Label
          htmlFor="import-secret"
          hint={
            kind === "base58"
              ? "≈ 88 base58 characters"
              : "[12, 34, 56, …]  · 64 integers"
          }
        >
          Secret key
        </Label>
        {kind === "base58" ? (
          <Input
            id="import-secret"
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
            id="import-secret"
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
          <Label htmlFor="import-pass" hint="≥ 8 characters">
            Passphrase
          </Label>
          <Input
            id="import-pass"
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <Label htmlFor="import-confirm">Confirm</Label>
          <Input
            id="import-confirm"
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

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Encrypting…" : "Import and unlock"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Generate success — muestra address + secret una sola vez
// ============================================================================

function GenerateSuccess({
  address,
  secretBase58,
  onDone,
}: {
  address: string;
  secretBase58: string;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const copy = async (text: string, kind: "addr" | "secret") => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "addr") {
        setCopiedAddr(true);
        setTimeout(() => setCopiedAddr(false), 1500);
      } else {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 1500);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <ModalHeader title="Save your secret. Now." onClose={onDone} />
      <div className="p-8 space-y-8">
        <p className="t-body text-[var(--color-text)]">
          A new bot wallet has been generated, encrypted with your passphrase,
          and unlocked. Below is the secret key. <strong>This is the only
          time you&apos;ll see it.</strong>
        </p>

        {/* Address */}
        <div>
          <div className="flex items-center justify-between">
            <span className="t-eyebrow text-[var(--color-text-muted)]">
              Address
            </span>
            <button
              type="button"
              onClick={() => copy(address, "addr")}
              className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
            >
              {copiedAddr ? "copied" : "copy"}
            </button>
          </div>
          <div className="mt-2 t-num break-all text-[var(--color-text)]">
            {address}
          </div>
        </div>

        {/* Secret (oculto por defecto) */}
        <div className="border-l-2 border-[var(--color-danger)] pl-5">
          <div className="flex items-center justify-between">
            <span className="t-eyebrow text-[var(--color-danger)]">
              Secret key · base58
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShown(!shown)}
                className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                {shown ? "hide" : "reveal"}
              </button>
              <button
                type="button"
                onClick={() => copy(secretBase58, "secret")}
                className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
              >
                {copiedSecret ? "copied" : "copy"}
              </button>
            </div>
          </div>
          <div className="mt-2 t-num break-all text-[var(--color-text)] min-h-[1.5rem]">
            {shown ? secretBase58 : "•".repeat(60)}
          </div>
        </div>

        {/* Confirmación */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="t-body text-[var(--color-text)]">
            I&apos;ve saved the secret key in a safe place (password manager,
            offline backup). I understand it won&apos;t be shown again.
          </span>
        </label>

        {/* Next step hint */}
        <div className="border-l-2 border-[var(--color-accent)] pl-5">
          <div className="t-eyebrow text-[var(--color-accent-bright)]">
            Next
          </div>
          <p className="mt-2 t-small text-[var(--color-text-muted)]">
            Send SOL (for fees) and the tokens you want to manage to{" "}
            <span className="t-num text-[var(--color-text)]">
              {truncateAddress(address, 6, 6)}
            </span>
            . Then open <em>Positions</em> and set up an auto-exit.
          </p>
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={onDone} disabled={!saved}>
            Continue
          </Button>
        </div>
      </div>
    </>
  );
}
