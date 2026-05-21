/**
 * Catálogo compartido de artículos. La sidebar lo enumera, el index de
 * /docs lo lista, y cada página de artículo importa su propia entrada
 * para mostrar título + eyebrow consistentes.
 */
export type Article = {
  slug: string;
  n: string;
  label: string;
  blurb: string;
};

export const ARTICLES: readonly Article[] = [
  {
    slug: "/docs/getting-started",
    n: "01",
    label: "Getting started",
    blurb:
      "The three-step walkthrough from blank slate to your first auto-exit, with the questions you'll hit at each step.",
  },
  {
    slug: "/docs/bot-wallet",
    n: "02",
    label: "The bot wallet",
    blurb:
      "Why a dedicated wallet, the three paths to provide a key, and what 'blast radius' really means for each.",
  },
  {
    slug: "/docs/auto-exit",
    n: "03",
    label: "Auto-exit triggers",
    blurb:
      "Take-profit and stop-loss prices, slippage, exit-token swap, and what dry-run simulation actually simulates.",
  },
  {
    slug: "/docs/operational",
    n: "04",
    label: "Operations",
    blurb:
      "Restarts, lock/unlock semantics, pausing and resuming, and what happens when something errors mid-close.",
  },
  {
    slug: "/docs/security",
    n: "05",
    label: "Security model",
    blurb:
      "Localhost-only bind, scrypt + AES-GCM at rest, the exact threat model and the failure modes you should know.",
  },
  {
    slug: "/docs/faq",
    n: "06",
    label: "FAQ",
    blurb:
      "Why isn't this Phantom-style, what about mainnet, what if Solana congests, and other recurring questions.",
  },
] as const;

export function articleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
