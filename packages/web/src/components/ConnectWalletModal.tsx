"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { Input, PasswordInput, Textarea, Label } from "@/components/ui/Input";
import { FieldError } from "@/components/ui/Card";
import { trpc } from "@/lib/trpc";
import { useConnectWallet } from "@/lib/connect-wallet";
import { truncateAddress, formatTokenAmount } from "@/lib/format";

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
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] shadow-xl">
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
      <ModalHeader title="Set up the bot's wallet" onClose={close} />

      <Preamble />

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-hairline)]">
        <TabButton active={tab === "generate"} onClick={() => setTab("generate")}>
          Generate
        </TabButton>
        <TabButton active={tab === "base58"} onClick={() => setTab("base58")}>
          Import key
        </TabButton>
        <TabButton active={tab === "json"} onClick={() => setTab("json")}>
          Advanced · JSON
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
// Preamble — explica el modelo antes de las tabs
// ============================================================================

function Preamble() {
  const { close } = useConnectWallet();
  return (
    <div className="border-b border-[var(--color-hairline)] bg-[var(--color-bg)]/40 px-6 py-5">
      <p className="t-small text-[var(--color-text-muted)]">
        This is the wallet the bot uses to sign close transactions
        autonomously — including while you&apos;re asleep.{" "}
        <span className="text-[var(--color-text)]">
          It is not a Phantom-style connect.
        </span>{" "}
        Adapters need you to approve every signature, which doesn&apos;t work
        for a watcher. The key lives encrypted on this machine; the bot
        decrypts it in memory when needed. Pick how you want to provide one.
      </p>
      <div className="mt-3">
        <Link
          href="/docs/bot-wallet"
          onClick={close}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          → Why a bot wallet?
        </Link>
      </div>
    </div>
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
        A fresh ed25519 keypair, created on this machine and encrypted with
        your passphrase. You&apos;ll see the secret <strong>once</strong>{" "}
        — save it in your password manager. Same format Phantom and Backpack
        accept, so you can also import the secret into them as a new account
        and open LP positions from it. <span className="text-[var(--color-text-dim)]">Best when you don&apos;t
        already have a dedicated operational account.</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="gen-passphrase" hint="≥ 8 characters">
            Passphrase
          </Label>
          <PasswordInput
            id="gen-passphrase"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <Label htmlFor="gen-confirm">Confirm</Label>
          <PasswordInput
            id="gen-confirm"
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
          ? "Paste the private key of a single Solana account in base58 form — typically the one Phantom or Backpack exports for a specific account (≈ 88 characters). Seed phrases are not accepted, so only this one address ever reaches this server."
          : "Paste the wallet.json contents from Solana CLI — a JSON array of 64 integers, e.g. [12, 45, 200, …]. Same scope as the Import key tab: this represents a single account."}
      </p>

      <ImportWarning />

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
          <PasswordInput
            id="import-secret"
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
          <PasswordInput
            id="import-pass"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <Label htmlFor="import-confirm">Confirm</Label>
          <PasswordInput
            id="import-confirm"
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
// Import warning — corrige la imprecisión "blast radius = wallet entera"
// ============================================================================

function ImportWarning() {
  return (
    <div className="border-l-2 border-[var(--color-warning)] bg-[var(--color-warning-bg)] px-5 py-4">
      <div className="t-eyebrow text-[var(--color-warning)]">
        Operational scope
      </div>
      <p className="mt-2 t-small text-[var(--color-text)]">
        The key is held encrypted at rest on this machine and decrypted in
        memory only while the vault is unlocked. If both your passphrase and
        the vault file were compromised, the assets at <em>this single
        address</em> could be moved by the attacker — nothing else in your
        wallet, no other accounts, no seed-derived addresses.
      </p>
      <p className="mt-3 t-small text-[var(--color-text-muted)]">
        Standard practice is to import an account dedicated to active
        operations (a &ldquo;hot&rdquo; account separate from cold holdings),
        not the account where you store everything.{" "}
        <Link
          href="/docs/bot-wallet#blast-radius"
          className="text-[var(--color-accent-bright)] hover:underline"
        >
          → Read the precise blast radius
        </Link>
      </p>
    </div>
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

        {/* Address — con QR + balance + faucet */}
        <AddressBlock
          address={address}
          copied={copiedAddr}
          onCopy={() => copy(address, "addr")}
        />

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
          <ol className="mt-3 space-y-2 t-small text-[var(--color-text-muted)]">
            <li>
              <span className="text-[var(--color-text-dim)]">01 ·</span>{" "}
              Import this secret into Phantom or Backpack as a{" "}
              <em>new account</em> (Settings → Add wallet → Import private
              key). The bot wallet then sits alongside your main and you can
              fund it + open LP positions from it via the wallet UI you
              already know.
            </li>
            <li>
              <span className="text-[var(--color-text-dim)]">02 ·</span> Fund
              it at{" "}
              <span className="t-num text-[var(--color-text)]">
                {truncateAddress(address, 6, 6)}
              </span>{" "}
              with SOL (for fees) and the tokens you want it to manage.
            </li>
            <li>
              <span className="text-[var(--color-text-dim)]">03 ·</span> Open
              an LP position on Orca while the bot account is selected in your
              wallet. It will appear under <em>Positions</em> here for
              auto-exit setup.
            </li>
          </ol>
          <p className="mt-3 t-small text-[var(--color-text-dim)]">
            Alternative: transfer the NFT of an existing position from any
            account you control to this address.
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

// ============================================================================
// AddressBlock — address text + QR + balance live + faucet link
// ============================================================================

function AddressBlock({
  address,
  copied,
  onCopy,
}: {
  address: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const settings = trpc.settings.get.useQuery();
  const balance = trpc.wallet.balance.useQuery(
    { address },
    { refetchInterval: 5_000 },
  );
  const isDevnet = settings.data?.network === "devnet";
  const solBalance = balance.data?.lamports ?? 0;
  const balanceText = formatTokenAmount(String(solBalance), 9, 6);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
      {/* Left: address text + balance + faucet */}
      <div className="md:col-span-8 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="t-eyebrow text-[var(--color-text-muted)]">
              Address
            </span>
            <button
              type="button"
              onClick={onCopy}
              className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
          <div className="mt-2 t-num break-all text-[var(--color-text)]">
            {address}
          </div>
        </div>

        <div className="flex items-baseline justify-between hairline-t pt-3">
          <span className="t-eyebrow text-[var(--color-text-muted)]">
            Balance
          </span>
          <span className="t-num text-[var(--color-text)]">
            {balance.isLoading ? "…" : `${balanceText} SOL`}
          </span>
        </div>

        {isDevnet ? (
          <a
            href={`https://faucet.solana.com/?walletAddress=${address}&amount=1&network=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block t-eyebrow text-[var(--color-accent-bright)] hover:underline"
          >
            → Get devnet SOL from the faucet
          </a>
        ) : null}
      </div>

      {/* Right: QR */}
      <div className="md:col-span-4 flex flex-col items-center justify-start">
        <div className="rounded-xl border border-[var(--color-border-strong)] bg-white p-3">
          <QRCodeSVG
            value={address}
            size={132}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#0c0a08"
          />
        </div>
        <span className="mt-3 t-eyebrow text-[var(--color-text-dim)]">
          scan to send funds
        </span>
      </div>
    </div>
  );
}
