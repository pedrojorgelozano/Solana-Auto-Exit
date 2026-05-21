import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "danger" | "paper";
}

/**
 * Card "Light cuaderno": panel blanco con borde sutil + sombra ligera +
 * rounded-2xl. Antes (ADR-017) era una sección con hairlines top+bottom;
 * el nuevo estilo separa visualmente con espacio + caja, no con líneas.
 *
 * - default: card blanco estándar.
 * - paper: fondo crema más cálido para zonas densas (data, panels).
 * - danger: card con borde danger, fondo danger-bg muy suave.
 */
export function Card({
  variant = "default",
  className = "",
  ...rest
}: CardProps) {
  const variantClass =
    variant === "danger"
      ? "bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/40"
      : variant === "paper"
        ? "bg-[var(--color-paper)] border border-[var(--color-border-strong)]"
        : "bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] shadow-[0_1px_2px_rgba(31,29,26,0.04),0_2px_8px_rgba(31,29,26,0.04)]";
  return (
    <section
      className={`p-6 sm:p-8 rounded-2xl ${variantClass} ${className}`}
      {...rest}
    />
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return <div className="t-eyebrow mb-3">{children}</div>;
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 t-small text-[var(--color-danger)]">{children}</p>
  );
}

/**
 * Bloque sin borde, solo padding — para zonas dentro de una Card padre.
 */
export function Section({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`py-6 ${className}`} {...rest} />;
}

/**
 * Wrapper que pinta una línea VERTICAL entre items children. Útil para
 * crear filas de stats / KPIs con divisores discretos.
 */
export function ColumnedRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex divide-x divide-[var(--color-hairline)] ${className}`}
    >
      {children}
    </div>
  );
}
