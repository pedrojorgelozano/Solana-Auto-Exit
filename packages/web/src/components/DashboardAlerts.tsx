"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n/context";
import { formatTokenAmount } from "@/lib/format";

// 0.05 SOL — margen razonable para ~10 cierres + ATA creation si aplica.
// Hardcoded por ahora; si crece la demanda, mover a settings.
const LOW_BALANCE_LAMPORTS = 50_000_000;

// Strings literales que el server pone en `lastError` cuando pausa tasks
// automáticamente (vault-lock o boot tras reinicio). Si el server los
// cambia, ajustar aquí — son la heurística para distinguir paused-system
// de paused-user, ya que no hay campo `pausedReason` persistido.
// Fuente: packages/server/src/tasks/manager.ts `pauseAllOnVaultLock` y
// `boot`.
const SYSTEM_PAUSE_MARKERS = [
  "Vault was locked while running",
  "Server restarted; resume after unlocking",
];

function isSystemPaused(lastError: string | null): boolean {
  if (!lastError) return false;
  return SYSTEM_PAUSE_MARKERS.some((m) => lastError.includes(m));
}

/**
 * Bloque de alertas del dashboard. Solo renderiza algo cuando hay un
 * problema accionable real (balance bajo del bot, tasks pausadas por
 * sistema esperando resume, tasks en error). Cuando todo va bien (caso
 * del 95% del tiempo) → null.
 *
 * Coherente con la filosofía "set and forget": el dashboard no grita
 * salvo que haya algo que decidir.
 */
export function DashboardAlerts({
  owner,
  unlocked,
}: {
  owner: string | null;
  unlocked: boolean;
}) {
  const { t } = useT();
  const a = t.home.alerts;

  const balance = trpc.wallet.balance.useQuery(
    { address: owner ?? "" },
    { enabled: !!owner, refetchInterval: 60_000 },
  );
  const tasks = trpc.tasks.list.useQuery(undefined, {
    refetchInterval: 5_000,
  });
  // El balance lo consulta el server contra el RPC configurado en
  // settings — la network activa importa porque una wallet con SOL en
  // mainnet aparece como 0 si consultas devnet. Surface el contexto
  // en el callout para que el usuario lo entienda.
  const settings = trpc.settings.get.useQuery();
  const network = settings.data?.network ?? "devnet";
  const start = trpc.tasks.start.useMutation();
  const utils = trpc.useUtils();

  const lowBalance =
    balance.data !== undefined &&
    balance.data.lamports < LOW_BALANCE_LAMPORTS;
  const balanceSolStr = balance.data
    ? formatTokenAmount(String(balance.data.lamports), 9, 4)
    : "?";

  const errorCount = (tasks.data ?? []).filter((t) => t.status === "error")
    .length;

  // Candidatas a bulk-resume: solo cuando la wallet ya está unlocked
  // (sin unlock no puede resumir). Las pausas user no se incluyen — el
  // user las pausó a propósito.
  const systemPaused = (tasks.data ?? []).filter(
    (t) => t.status === "paused" && isSystemPaused(t.lastError),
  );
  const showResumeCallout = unlocked && systemPaused.length > 0;

  if (!lowBalance && errorCount === 0 && !showResumeCallout) return null;

  const handleResumeAll = async () => {
    await Promise.allSettled(
      systemPaused.map((task) => start.mutateAsync({ id: task.id })),
    );
    await utils.tasks.list.invalidate();
  };

  return (
    <div className="mt-6 flex flex-col gap-3">
      {showResumeCallout ? (
        <AlertCallout
          eyebrow={a.resumeEyebrow(systemPaused.length)}
          body={a.resumeBody}
          ctaLabel={start.isPending ? a.resumeCtaPending : a.resumeCta}
          ctaOnClick={handleResumeAll}
          ctaDisabled={start.isPending}
          icon={<ResumeIcon />}
        />
      ) : null}
      {errorCount > 0 ? (
        <AlertCallout
          eyebrow={a.errorsEyebrow(errorCount)}
          body={a.errorsBody}
          ctaLabel={a.errorsCta}
          ctaHref="/tasks?filter=errors"
          icon={<ErrorIcon />}
        />
      ) : null}
      {lowBalance ? (
        <AlertCallout
          eyebrow={a.lowBalanceEyebrow}
          body={a.lowBalanceBody(balanceSolStr, network)}
          ctaLabel={a.lowBalanceCta}
          ctaHref="/wallet"
          icon={<LowBalanceIcon />}
        />
      ) : null}
    </div>
  );
}

function AlertCallout({
  eyebrow,
  body,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  ctaDisabled,
  icon,
}: {
  eyebrow: string;
  body: string;
  ctaLabel: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  ctaDisabled?: boolean;
  icon: React.ReactNode;
}) {
  const ctaClass = `
    inline-flex flex-none items-center gap-2 self-center
    rounded-[7px] border border-[var(--color-warning)]/45
    px-3.5 py-2 text-[12px] font-semibold uppercase tracking-[0.18em]
    text-[var(--color-warning)]
    transition-colors hover:bg-[var(--color-warning)]/10
    disabled:cursor-not-allowed disabled:opacity-50
  `;
  const arrow = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[13px] w-[13px]"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
  return (
    <div
      role="status"
      aria-live="polite"
      className="
        flex items-center gap-4
        rounded-[10px] border border-[var(--color-hairline)]
        border-l-[3px] border-l-[var(--color-warning)]
        bg-[var(--color-bg-elevated)]
        px-5 py-4
      "
    >
      <span
        className="
          inline-flex h-9 w-9 flex-none items-center justify-center
          rounded-full bg-[var(--color-warning)]/12
        "
        aria-hidden
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--color-warning)]">
          {eyebrow}
        </div>
        <p className="mt-1 text-[15px] text-[var(--color-text)]">{body}</p>
      </div>
      {ctaHref ? (
        <Link href={ctaHref} className={ctaClass}>
          {ctaLabel}
          {arrow}
        </Link>
      ) : (
        <button
          type="button"
          onClick={ctaOnClick}
          disabled={ctaDisabled}
          className={ctaClass}
        >
          {ctaLabel}
          {arrow}
        </button>
      )}
    </div>
  );
}

function ResumeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-warning)"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[17px] w-[17px]"
      aria-hidden
    >
      <rect x="5" y="5" width="4" height="14" rx="0.5" />
      <rect x="13" y="5" width="4" height="14" rx="0.5" />
    </svg>
  );
}

function LowBalanceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-warning)"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[17px] w-[17px]"
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16 14.5h2" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-warning)"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[17px] w-[17px]"
      aria-hidden
    >
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
