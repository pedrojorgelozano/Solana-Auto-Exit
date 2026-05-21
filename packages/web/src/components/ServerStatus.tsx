"use client";

import { trpc } from "@/lib/trpc";

/**
 * Indicador discreto del estado del backend. Texto mono pequeño con
 * un dot. Sin pill ni borde — encaja en cualquier header.
 */
export function ServerStatus() {
  const health = trpc.health.useQuery(undefined, { refetchInterval: 10_000 });

  if (health.isLoading) {
    return <Inline tone="neutral">connecting</Inline>;
  }

  if (health.error) {
    return (
      <Inline tone="danger" title={health.error.message}>
        bot unreachable
      </Inline>
    );
  }

  if (!health.data) {
    return <Inline tone="neutral">no data</Inline>;
  }

  return <Inline tone="positive">bot running</Inline>;
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
