import Link from "next/link";

/**
 * Header de página interna (pages bajo /). El GlobalHeader ya tiene
 * server status y vault chip; aquí solo back-link, eyebrow, título y
 * descripción. Hairline al pie.
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
      {back ? (
        <Link
          href={back.href}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          ← {back.label}
        </Link>
      ) : null}

      {eyebrow ? (
        <div
          className={`${back ? "mt-8" : ""} t-eyebrow text-[var(--color-accent-bright)]`}
        >
          {eyebrow}
        </div>
      ) : null}
      <h1 className={`${eyebrow || back ? "mt-3" : ""} t-h1`}>{title}</h1>
      {description ? (
        <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
          {description}
        </p>
      ) : null}
    </header>
  );
}
