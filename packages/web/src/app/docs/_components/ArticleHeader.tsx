import type { Article } from "./articles";

/**
 * Header consistente para cada artículo de /docs. Render: número en cobre,
 * label como h1, blurb del catálogo como subtítulo.
 */
export function ArticleHeader({ article }: { article: Article }) {
  return (
    <header className="mb-10 pb-8 hairline-b">
      <div className="t-eyebrow text-[var(--color-text-muted)]">
        Docs <span className="text-[var(--color-text-dim)]">·</span>{" "}
        <span className="t-num text-[var(--color-accent-bright)]">
          {article.n}
        </span>
      </div>
      <h1 className="mt-3 t-h1">{article.label}</h1>
      <p className="mt-4 max-w-2xl t-body text-[var(--color-text-muted)]">
        {article.blurb}
      </p>
    </header>
  );
}
