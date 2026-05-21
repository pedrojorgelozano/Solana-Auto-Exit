import Link from "next/link";
import { DocsNav } from "./_components/DocsNav";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-32 pt-12 fade-in">
      <Link
        href="/"
        className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        ← Home
      </Link>

      <div className="mt-8 grid gap-10 md:grid-cols-12">
        <aside className="md:col-span-3 md:border-r md:border-[var(--color-hairline)] md:pr-6">
          <DocsNav />
        </aside>
        <article className="md:col-span-9 md:pl-2">{children}</article>
      </div>
    </main>
  );
}
