"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { Input, PasswordInput, Textarea, Label } from "@/components/ui/Input";
import { FieldError } from "@/components/ui/Card";
import { trpc } from "@/lib/trpc";
import { formatTrpcError } from "@/lib/trpcError";
import { useConnectWallet } from "@/lib/connect-wallet";
import { truncateAddress, formatTokenAmount } from "@/lib/format";
import { useT } from "@/i18n/context";

type Tab = "generate" | "base58" | "json";

export function ConnectWalletModal() {
  const { isOpen, close } = useConnectWallet();
  const { t } = useT();

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
    <div role="dialog" aria-modal="true">
      {/* Backdrop — capa fija que oscurece el resto. Click cierra. */}
      <button
        type="button"
        aria-label={t.modal.closeAria}
        onClick={close}
        className="fixed inset-0 z-40 bg-black/70 cursor-default"
        style={{ backdropFilter: "blur(4px)" }}
      />

      {/* Panel — centrado con translate. Scroll interno si excede viewport.
          z-index explícitamente mayor que el backdrop. */}
      <div
        className="
          fixed left-1/2 top-1/2 z-50
          w-[calc(100vw-2rem)] max-w-2xl
          max-h-[calc(100vh-4rem)] overflow-y-auto
          rounded-2xl border border-[var(--color-border-strong)]
          bg-[var(--color-bg-elevated)] shadow-2xl
        "
        style={{ transform: "translate(-50%, -50%)" }}
      >
        <ModalContent />
      </div>
    </div>
  );
}

function ModalContent() {
  const { close } = useConnectWallet();
  const { t } = useT();
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
      <ModalHeader title={t.modal.title} onClose={close} />

      <Preamble />

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-hairline)]">
        <TabButton active={tab === "generate"} onClick={() => setTab("generate")}>
          {t.modal.tabs.generate}
        </TabButton>
        <TabButton active={tab === "base58"} onClick={() => setTab("base58")}>
          {t.modal.tabs.importKey}
        </TabButton>
        <TabButton active={tab === "json"} onClick={() => setTab("json")}>
          {t.modal.tabs.advancedJson}
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
  const { t } = useT();
  return (
    <div className="border-b border-[var(--color-hairline)] bg-[var(--color-bg)]/40 px-6 py-5">
      <p className="t-small text-[var(--color-text-muted)]">
        {t.modal.intro}
        <br />
        <span className="text-[var(--color-text)]">{t.modal.notPhantom}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href="/docs/bot-wallet"
          onClick={close}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
        >
          {t.home.eyebrow.whatIs}
        </Link>
        <Link
          href="/docs/disclaimer"
          onClick={close}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
        >
          {t.modal.disclaimerLink}
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Header + tab buttons
// ============================================================================

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useT();
  return (
    <div className="flex items-center justify-between p-6 border-b border-[var(--color-hairline)]">
      <div>
        <div className="t-eyebrow text-[var(--color-accent-bright)]">
          {t.wallet.pageEyebrow}
        </div>
        <h2 className="mt-1 t-h2">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t.modal.closeAria}
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
  const { t } = useT();
  const g = t.modal.generate;
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
      setError(g.errorShort);
      return;
    }
    if (passphrase !== confirm) {
      setError(g.errorMismatch);
      return;
    }
    try {
      await gen.mutateAsync({ passphrase });
    } catch (err) {
      setError(formatTrpcError(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="t-body text-[var(--color-text-muted)]">
        {g.body}{" "}
        <span className="text-[var(--color-text-dim)]">{g.finePrint}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="gen-passphrase" hint={g.hint}>
            {g.passphraseLabel}
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
          <Label htmlFor="gen-confirm">{g.confirmLabel}</Label>
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
          {gen.isPending ? g.generating : g.submitCta}
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
  const { t } = useT();
  const ic = t.modal.importCommon;
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
      setError(ic.errorShort);
      return;
    }
    if (passphrase !== confirm) {
      setError(ic.errorMismatch);
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
      setError(formatTrpcError(err));
    }
  };

  const busy = create.isPending || unlock.isPending;

  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="t-body text-[var(--color-text-muted)]">
        {kind === "base58"
          ? t.modal.importBase58.body
          : t.modal.importJson.body}
      </p>

      <ImportWarning />

      <div>
        <Label
          htmlFor="import-secret"
          hint={kind === "base58" ? ic.secretHintBase58 : ic.secretHintJson}
        >
          {ic.secretLabel}
        </Label>
        {kind === "base58" ? (
          <PasswordInput
            id="import-secret"
            autoComplete="off"
            spellCheck={false}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={ic.placeholderBase58}
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
            placeholder={ic.placeholderJson}
            required
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="import-pass" hint={ic.passphraseHint}>
            {ic.passphraseLabel}
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
          <Label htmlFor="import-confirm">{ic.confirmLabel}</Label>
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
          {busy ? ic.importing : ic.submitCta}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Import warning — corrige la imprecisión "blast radius = wallet entera"
// ============================================================================

function ImportWarning() {
  const { t } = useT();
  const w = t.modal.importWarning;
  return (
    <div className="border-l-2 border-[var(--color-warning)] bg-[var(--color-warning-bg)] px-5 py-4">
      <div className="t-eyebrow text-[var(--color-warning)]">{w.eyebrow}</div>
      <p className="mt-2 t-small text-[var(--color-text)]">{w.body}</p>
      <p className="mt-3 t-small text-[var(--color-text-muted)]">
        {w.body2}{" "}
        <Link
          href="/docs/bot-wallet#blast-radius"
          className="text-[var(--color-accent-bright)] hover:underline"
        >
          {w.readMore}
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
  const { t } = useT();
  const su = t.modal.success;
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
      <ModalHeader title={su.title} onClose={onDone} />
      <div className="p-8 space-y-8">
        <p className="t-body text-[var(--color-text)]">
          {su.bodyIntro} <strong>{su.bodyStrong}</strong>
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
              {su.secretEyebrow}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShown(!shown)}
                className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                {shown ? su.hide : su.reveal}
              </button>
              <button
                type="button"
                onClick={() => copy(secretBase58, "secret")}
                className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
              >
                {copiedSecret ? su.copied : su.copy}
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
          <span className="t-body text-[var(--color-text)]">{su.savedCheckbox}</span>
        </label>

        {/* Next step hint */}
        <div className="border-l-2 border-[var(--color-accent)] pl-5">
          <div className="t-eyebrow text-[var(--color-accent-bright)]">
            {su.nextEyebrow}
          </div>
          <ol className="mt-3 space-y-2 t-small text-[var(--color-text-muted)]">
            <li>
              <span className="text-[var(--color-text-dim)]">01 ·</span>{" "}
              {su.step1Body}
            </li>
            <li>
              <span className="text-[var(--color-text-dim)]">02 ·</span>
              {su.step2BodyPrefix}
              <span className="t-num text-[var(--color-text)]">
                {truncateAddress(address, 6, 6)}
              </span>
              {su.step2BodySuffix}
            </li>
            <li>
              <span className="text-[var(--color-text-dim)]">03 ·</span>{" "}
              {su.step3Body}
            </li>
          </ol>
          <p className="mt-3 t-small text-[var(--color-text-dim)]">
            {su.alternative}
          </p>
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={onDone} disabled={!saved}>
            {su.continueCta}
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
  const { t } = useT();
  const a = t.modal.address;
  const su = t.modal.success;
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
              {a.label}
            </span>
            <button
              type="button"
              onClick={onCopy}
              className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
            >
              {copied ? su.copied : su.copy}
            </button>
          </div>
          <div className="mt-2 t-num break-all text-[var(--color-text)]">
            {address}
          </div>
        </div>

        <div className="flex items-baseline justify-between hairline-t pt-3">
          <span className="t-eyebrow text-[var(--color-text-muted)]">
            {a.balance}
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
            {a.faucetCta}
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
          {a.scanHint}
        </span>
      </div>
    </div>
  );
}
