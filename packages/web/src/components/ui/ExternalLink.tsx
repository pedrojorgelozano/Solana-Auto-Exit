import type { ReactNode } from "react";

/**
 * Link a una URL externa que abre en pestaña nueva (`target="_blank"`).
 *
 * Ejemplos: GitHub repo / INSTALL.md, app.meteora.ag, helius.dev, quicknode.
 *
 * Diferenciadores frente a [[DocsLink]] (interno):
 *   - icono `↗` al final (flecha oblicua = convención universal "abre fuera").
 *   - color accent-bright en lugar de muted (destaca más; el icono ya pista,
 *     el color refuerza).
 *   - `target="_blank"` + `rel="noopener noreferrer"` por defecto, sin que el
 *     call-site tenga que recordarlos cada vez.
 */
export function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        "inline-flex items-baseline gap-1 t-eyebrow " +
        "text-[var(--color-accent-bright)] hover:text-[var(--color-accent)] " +
        "transition-colors " +
        className
      }
    >
      <span>{children}</span>
      <span aria-hidden="true" className="text-[0.85em]">↗</span>
    </a>
  );
}
