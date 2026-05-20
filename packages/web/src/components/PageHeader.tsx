import Link from "next/link";
import { ServerStatus } from "./ServerStatus";

/**
 * Header de página interna. Estructura tipográfica editorial:
 * - Top bar fino con back-link a la izquierda y server status a la derecha.
 * - Eyebrow + título en display serif debajo.
 * - Descripción en body, dim.
 *
 * No es el header global (eso es para R3 cuando reescriba la home).
 */
export function PageHeader({
  title,
  description,
  back,
  eyebrow,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  eyebrow?: string;
}) {
  return (
    <header className="mb-12 pb-8 hairline-b">
      <div className="flex items-center justify-between gap-3">
        {back ? (
          <Link
            href={back.href}
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            ← {back.label}
          </Link>
        ) : (
          <span />
        )}
        <ServerStatus />
      </div>

      {eyebrow ? (
        <div className="mt-10 t-eyebrow text-[var(--color-accent-bright)]">
          {eyebrow}
        </div>
      ) : null}
      <h1 className={`${eyebrow ? "mt-3" : "mt-10"} t-h1`}>{title}</h1>
      {description ? (
        <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
          {description}
        </p>
      ) : null}
    </header>
  );
}
