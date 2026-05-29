import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Navegación a una página de docs INTERNA (`/docs/security`, etc.).
 *
 * El componente añade automáticamente la flecha `→` al inicio. Los strings
 * de i18n NO deben llevar flecha — se la pone el componente. Esto evita
 * que un texto traducido olvide la flecha y se camufle con [[TextAction]],
 * o que duplique flechas si el call-site la añadía a mano.
 *
 * Color muted con hover bright, sin subrayado — distinto de TextAction
 * (que va con subrayado punteado) y de ExternalLink (que va con color
 * accent-bright + icono ↗ para señalar "abre fuera").
 */
export function DocsLink({
  href,
  children,
  className = "",
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** Opcional: dispara antes del navigation. Útil para cerrar modales. */
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        "inline-flex items-baseline gap-1.5 t-eyebrow " +
        "text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] " +
        "transition-colors " +
        className
      }
    >
      <span aria-hidden="true">→</span>
      <span>{children}</span>
    </Link>
  );
}
