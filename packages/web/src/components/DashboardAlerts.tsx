"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n/context";
import { formatTokenAmount, formatPrice } from "@/lib/format";
import { taskDetailHref } from "@/lib/routes";

// 50 MB. Uso normal son <2MB/año (1 task por mes, ~100 history rows
// por task con payload pequeño). Saltar por encima de esto indica
// con casi total seguridad un bug que infla la DB.
const DB_BLOATED_THRESHOLD_BYTES = 50 * 1024 * 1024;

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
  // 0 → desactivado (el user pidió no ver el callout nunca). Default
  // server-side es 50_000_000 (0.05 SOL); mientras la settings.get carga,
  // usamos el mismo default como fallback.
  const lowBalanceThreshold =
    settings.data?.lowBalanceThresholdLamports ?? 50_000_000;
  // Health check del tamaño SQLite. Uso normal son <2MB/año; un salto
  // por encima de 50MB indica con casi total seguridad un bug futuro
  // (un appendHistory en el polling loop, etc.). Refetch cada 5 min —
  // el size cambia lento, no hace falta polling agresivo.
  const dbSizeQuery = trpc.meta.dbSize.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
  });
  const dbSizeBytes = dbSizeQuery.data?.bytes ?? 0;
  const dbBloated = dbSizeBytes > DB_BLOATED_THRESHOLD_BYTES;
  const dbSizeMb = (dbSizeBytes / (1024 * 1024)).toFixed(1);
  // Análisis de "resume seguro": el server lee el precio actual de cada task
  // pausada-por-sistema y dice si cruzó su trigger. Solo cuando unlocked
  // (sin unlock no puede resumir y el endpoint necesita la clave para leer
  // precio). Refetch lento — solo hay candidatas tras un lock/reinicio, y el
  // precio cambia despacio frente a la decisión de revisar.
  const resumeCandidates = trpc.tasks.resumeCandidates.useQuery(undefined, {
    enabled: unlocked,
    refetchInterval: 30_000,
  });
  const candidates = resumeCandidates.data ?? [];
  // Invariante de seguridad: algo es "reanudable" SOLO si leímos un precio
  // real y NO cruzó. Precio nulo (RPC falló, posición cerrada) o cruzado →
  // siempre a "revisar". Nunca reanudamos a ciegas.
  const safeToResume = candidates.filter(
    (c) => c.currentPrice !== null && !c.crossed,
  );
  const toReview = candidates.filter(
    (c) => c.currentPrice === null || c.crossed,
  );
  const showSafeResume = unlocked && safeToResume.length > 0;
  const showReview = unlocked && toReview.length > 0;

  const start = trpc.tasks.start.useMutation();
  const utils = trpc.useUtils();

  const lowBalance =
    lowBalanceThreshold > 0 &&
    balance.data !== undefined &&
    balance.data.lamports < lowBalanceThreshold;
  // El balance falla típicamente cuando el RPC público de Solana
  // rate-limita o el rpcUrl está mal. No queremos disparar "low
  // balance" como falso positivo en ese caso — mejor un callout
  // explícito que diga "no se pudo verificar".
  const balanceQueryFailed = !!owner && unlocked && balance.isError;
  const balanceSolStr = balance.data
    ? formatTokenAmount(String(balance.data.lamports), 9, 4)
    : "?";

  const errorCount = (tasks.data ?? []).filter((t) => t.status === "error")
    .length;

  if (
    !lowBalance &&
    !balanceQueryFailed &&
    errorCount === 0 &&
    !showSafeResume &&
    !showReview &&
    !dbBloated
  )
    return null;

  // Solo reanudamos las que el server marcó seguras. Las "revisar" se
  // quedan pausadas hasta que el usuario decida task por task.
  const handleResumeSafe = async () => {
    await Promise.allSettled(
      safeToResume.map((c) => start.mutateAsync({ id: c.id })),
    );
    await Promise.all([
      utils.tasks.list.invalidate(),
      utils.tasks.resumeCandidates.invalidate(),
    ]);
  };

  return (
    <div className="mt-6 flex flex-col gap-3">
      {showReview ? (
        <ReviewCallout
          eyebrow={a.resumeReviewEyebrow(toReview.length)}
          body={a.resumeReviewBody}
          linkLabel={a.resumeReviewLink}
          items={toReview.map((c) => ({
            id: c.id,
            label: c.label,
            reason:
              c.currentPrice === null
                ? a.resumeUnverified
                : c.crossedBy === "stop_loss"
                  ? a.resumeCrossedStopLoss
                  : a.resumeCrossedTakeProfit,
            detail:
              c.currentPrice === null
                ? null
                : c.crossedBy === "stop_loss"
                  ? `${formatPrice(c.currentPrice)} ≤ ${formatPrice(c.stopLossPrice ?? 0)}`
                  : `${formatPrice(c.currentPrice)} ≥ ${formatPrice(c.takeProfitPrice ?? 0)}`,
          }))}
        />
      ) : null}
      {showSafeResume ? (
        <AlertCallout
          eyebrow={a.resumeSafeEyebrow(safeToResume.length)}
          body={a.resumeSafeBody}
          ctaLabel={start.isPending ? a.resumeSafeCtaPending : a.resumeSafeCta}
          ctaOnClick={handleResumeSafe}
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
      {balanceQueryFailed ? (
        <AlertCallout
          eyebrow={a.balanceErrorEyebrow}
          body={a.balanceErrorBody}
          ctaLabel={a.balanceErrorCta}
          ctaHref="/settings"
          icon={<LowBalanceIcon />}
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
      {dbBloated ? (
        <AlertCallout
          eyebrow={a.dbBloatedEyebrow}
          body={a.dbBloatedBody(dbSizeMb)}
          ctaLabel={a.dbBloatedCta}
          ctaHref="/tasks"
          icon={<DbIcon />}
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

/**
 * Callout de "revisar antes de reanudar": lista las tasks cuyo precio cruzó
 * el trigger mientras estaban pausadas (o no se pudo verificar). No tiene
 * bulk-action — cada una se revisa por separado, porque reanudarlas dispararía
 * un cierre. Cada fila enlaza al detalle de la task.
 */
function ReviewCallout({
  eyebrow,
  body,
  linkLabel,
  items,
}: {
  eyebrow: string;
  body: string;
  linkLabel: string;
  items: Array<{
    id: string;
    label: string;
    reason: string;
    detail: string | null;
  }>;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="
        rounded-[10px] border border-[var(--color-hairline)]
        border-l-[3px] border-l-[var(--color-warning)]
        bg-[var(--color-bg-elevated)]
        px-5 py-4
      "
    >
      <div className="flex items-center gap-4">
        <span
          className="
            inline-flex h-9 w-9 flex-none items-center justify-center
            rounded-full bg-[var(--color-warning)]/12
          "
          aria-hidden
        >
          <ReviewIcon />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--color-warning)]">
            {eyebrow}
          </div>
          <p className="mt-1 text-[15px] text-[var(--color-text)]">{body}</p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col">
        {items.map((it) => (
          <li
            key={it.id}
            className="
              flex items-center gap-3 py-2.5
              border-t border-[var(--color-hairline)]
            "
          >
            <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--color-text)]">
              {it.label}
            </span>
            <span className="flex-none text-[12px] text-[var(--color-text-muted)]">
              {it.reason}
              {it.detail ? (
                <span className="ml-1.5 font-mono text-[var(--color-text-dim)]">
                  {it.detail}
                </span>
              ) : null}
            </span>
            <Link
              href={taskDetailHref(it.id)}
              className="
                flex-none inline-flex items-center gap-1
                text-[12px] font-semibold uppercase tracking-[0.16em]
                text-[var(--color-warning)] hover:underline
              "
            >
              {linkLabel}
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewIcon() {
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
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </svg>
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

function DbIcon() {
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
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
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
