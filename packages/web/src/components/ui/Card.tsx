import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "danger" | "paper";
}

/**
 * "Card" en el nuevo lenguaje editorial NO es una píldora con bg-elevated.
 * Es una sección delimitada por hairlines verticales/horizontales. Sin
 * radius, sin sombra, sin fondo distinto por defecto.
 *
 * - default: hairlines top + bottom, padding generoso.
 * - paper: bg ligeramente más alto (--color-paper) para zonas de data densa.
 * - danger: hairline en oxblood-light, sutil, no rojo bandera.
 */
export function Card({
  variant = "default",
  className = "",
  ...rest
}: CardProps) {
  const variantClass =
    variant === "danger"
      ? "border-y border-[var(--color-danger)]/40"
      : variant === "paper"
        ? "border-y border-[var(--color-hairline)] bg-[var(--color-paper)]"
        : "border-y border-[var(--color-hairline)]";
  return (
    <section className={`py-8 ${variantClass} ${className}`} {...rest} />
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return <div className="t-eyebrow mb-3">{children}</div>;
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-sm text-[var(--color-danger)]">{children}</p>
  );
}

/**
 * Bloque sin hairlines, solo padding — para zonas dentro de una Card padre.
 */
export function Section({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`py-6 ${className}`} {...rest} />;
}

/**
 * Wrapper que pinta una hairline VERTICAL entre items children. Útil para
 * crear "columnas tipo periódico" con divisores discretos.
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
