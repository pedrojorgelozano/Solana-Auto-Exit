import Link from "next/link";
import { ServerStatus } from "./ServerStatus";

export function PageHeader({
  title,
  description,
  back,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
          <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            devnet · localhost
          </span>
        </div>
        <ServerStatus />
      </div>

      {back ? (
        <Link
          href={back.href}
          className="mt-6 inline-block text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← {back.label}
        </Link>
      ) : null}

      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-xl text-[var(--color-text-muted)]">
          {description}
        </p>
      ) : null}
    </header>
  );
}
