import Link from "next/link";
import { ARTICLES } from "./_components/articles";

export default function DocsIndex() {
  return (
    <div>
      <header className="mb-10 pb-8 hairline-b">
        <div className="t-eyebrow text-[var(--color-accent-bright)]">
          Documentation
        </div>
        <h1 className="mt-3 t-h1">How this thing works.</h1>
        <p className="mt-4 max-w-2xl t-body text-[var(--color-text-muted)]">
          Six short articles covering the model, the trade-offs, and the
          operational details. Read them in order if you&apos;re new; jump
          to whichever section you need otherwise.
        </p>
      </header>

      <ol className="divide-y divide-[var(--color-hairline)]">
        {ARTICLES.map((a) => (
          <li key={a.slug}>
            <Link
              href={a.slug}
              className="group grid grid-cols-12 gap-4 py-6 transition-colors hover:bg-white/[0.02] md:gap-6"
            >
              <div className="col-span-2 md:col-span-1">
                <span className="t-num text-[var(--color-accent-bright)]">
                  {a.n}
                </span>
              </div>
              <div className="col-span-10 md:col-span-4">
                <h2 className="t-h2 text-[var(--color-text)] group-hover:text-[var(--color-accent-bright)] transition-colors">
                  {a.label}
                </h2>
              </div>
              <div className="col-span-12 md:col-span-7">
                <p className="t-body text-[var(--color-text-muted)]">
                  {a.blurb}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
