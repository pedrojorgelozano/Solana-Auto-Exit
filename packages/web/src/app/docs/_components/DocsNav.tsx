"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ARTICLES } from "./articles";

export function DocsNav() {
  const path = usePathname();

  return (
    <nav className="md:sticky md:top-6">
      <Link
        href="/docs"
        className={`block t-eyebrow ${
          path === "/docs"
            ? "text-[var(--color-text)]"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        }`}
      >
        Docs · index
      </Link>

      <ol className="mt-6 space-y-3">
        {ARTICLES.map((a) => {
          const active = path === a.slug;
          return (
            <li key={a.slug}>
              <Link
                href={a.slug}
                className={`group flex items-baseline gap-3 ${
                  active
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                }`}
              >
                <span
                  className={`t-num shrink-0 ${
                    active
                      ? "text-[var(--color-accent-bright)]"
                      : "text-[var(--color-text-dim)] group-hover:text-[var(--color-text-muted)]"
                  }`}
                >
                  {a.n}
                </span>
                <span className="t-small">{a.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
