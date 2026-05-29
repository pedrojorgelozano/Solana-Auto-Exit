import type { ButtonHTMLAttributes } from "react";

/**
 * Acción local "tipo texto" — no es navegación, no es un botón primario.
 *
 * Ejemplos: "Copy", "Test connection", "use mainnet default", "Show full".
 *
 * Diferenciador clave frente a [[DocsLink]]: lleva un subrayado punteado
 * permanente que pasa a sólido en hover. El subrayado es la pista
 * "esto no te lleva a otra página, dispara una acción local". DocsLink en
 * cambio NO tiene subrayado pero SÍ una flecha → al inicio.
 *
 * Si la acción es primaria (Save, Lock, Resume, Delete) usa <Button> en su
 * lugar — esos llaman la atención con bg + borde, esto va inline con copy.
 */
type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export function TextAction({ className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={
        "t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] " +
        "underline decoration-dotted decoration-[var(--color-text-muted)]/50 underline-offset-4 " +
        "hover:decoration-solid hover:decoration-[var(--color-accent-bright)] " +
        "transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
        className
      }
      {...rest}
    >
      {children}
    </button>
  );
}
