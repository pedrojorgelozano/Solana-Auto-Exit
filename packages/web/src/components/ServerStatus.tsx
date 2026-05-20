"use client";

import { trpc } from "@/lib/trpc";

/**
 * Pequeño badge que muestra el estado de conexión con el backend tRPC.
 * Si el server está vivo → punto verde + versión.
 * Si no → punto rojo + mensaje.
 */
export function ServerStatus() {
  const health = trpc.health.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  if (health.isLoading) {
    return <Pill color="muted">connecting…</Pill>;
  }

  if (health.error) {
    return (
      <Pill color="danger" title={health.error.message}>
        server unreachable
      </Pill>
    );
  }

  if (!health.data) {
    return <Pill color="muted">no data</Pill>;
  }

  return (
    <Pill color="success">
      server v{health.data.version} ·{" "}
      {new Date(health.data.time).toLocaleTimeString()}
    </Pill>
  );
}

function Pill({
  color,
  children,
  title,
}: {
  color: "success" | "danger" | "muted";
  children: React.ReactNode;
  title?: string;
}) {
  const dotColor =
    color === "success"
      ? "bg-[var(--color-success)]"
      : color === "danger"
        ? "bg-[var(--color-danger)]"
        : "bg-[var(--color-text-muted)]";
  return (
    <div
      title={title}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1 text-xs text-[var(--color-text-muted)]"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {children}
    </div>
  );
}
