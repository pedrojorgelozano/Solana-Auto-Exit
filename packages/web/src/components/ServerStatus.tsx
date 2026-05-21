"use client";

import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n/context";

/**
 * Indicador discreto del estado del backend. Texto mono pequeño con
 * un dot. Sin pill ni borde — encaja en cualquier header.
 */
export function ServerStatus() {
  const health = trpc.health.useQuery(undefined, { refetchInterval: 10_000 });
  const { t } = useT();

  if (health.isLoading) {
    return <Inline tone="neutral">{t.header.connecting}</Inline>;
  }

  if (health.error) {
    return (
      <Inline tone="danger" title={health.error.message}>
        {t.header.botUnreachable}
      </Inline>
    );
  }

  if (!health.data) {
    return <Inline tone="neutral">{t.common.noData}</Inline>;
  }

  return <Inline tone="positive">{t.header.botRunning}</Inline>;
}

function Inline({
  children,
  tone,
  title,
}: {
  children: React.ReactNode;
  tone: "positive" | "neutral" | "danger";
  title?: string;
}) {
  const dotColor =
    tone === "positive"
      ? "bg-[var(--color-positive)]"
      : tone === "danger"
        ? "bg-[var(--color-danger)]"
        : "bg-[var(--color-text-muted)]";
  return (
    <span
      title={title}
      className="inline-flex items-center gap-2 t-eyebrow text-[var(--color-text-muted)]"
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {children}
    </span>
  );
}
