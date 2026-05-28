"use client";

import { useEffect, useState } from "react";
import { formatBufferRemaining } from "@/lib/format";
import { useT } from "@/i18n/context";

/**
 * Countdown vivo del time buffer cuando un trigger ya se cruzó pero la
 * task espera N tiempo antes de cerrar (anti-flapping). Renderiza una
 * línea inline amber pulsante con el remaining; devuelve null si no
 * aplica (sin firstCrossedAt, sin buffer, o ya expirado).
 *
 * Auto-update cada segundo mientras está montado. Se usa en el dashboard
 * para que el usuario vea "BUFFER · 5m 12s LEFT" sin tener que entrar al
 * detalle de la task.
 */
export function BufferCountdown({
  firstCrossedAt,
  bufferMs,
}: {
  firstCrossedAt: number | null;
  bufferMs: number | null;
}) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!firstCrossedAt || !bufferMs || bufferMs <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [firstCrossedAt, bufferMs]);

  const remaining = formatBufferRemaining(firstCrossedAt, bufferMs, now, t);
  if (!remaining) return null;

  return (
    <span className="inline-flex items-center gap-2 t-eyebrow text-[var(--color-warning)]">
      <span
        className="
          inline-block h-[7px] w-[7px] rounded-full bg-[var(--color-warning)]
          pulse-soft shadow-[0_0_0_3px_var(--color-warning-bg)]
        "
        aria-hidden
      />
      {t.home.hub.bufferLabel} · {remaining}
    </span>
  );
}
