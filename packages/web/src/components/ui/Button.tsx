import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "default" | "sm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * Botones "Light cuaderno": rounded-xl (12 px), padding generoso, altura
 * mínima 44 px para touch-target accesible (iOS/WCAG). Sin uppercase
 * agresivo — leen como botones de app moderna, no como labels de terminal.
 */
const base =
  "inline-flex items-center justify-center gap-2 border " +
  "font-medium transition-colors duration-150 " +
  "disabled:opacity-40 disabled:cursor-not-allowed select-none " +
  "focus-visible:outline-3 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2";

const sizes: Record<Size, string> = {
  default: "h-11 px-5 text-base rounded-xl",   // 44 px alto — touch target AA
  sm: "h-9 px-3.5 text-sm rounded-lg",         // 36 px — para acciones secundarias
};

const variants: Record<Variant, string> = {
  primary:
    "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] " +
    "hover:bg-[var(--color-accent-bright)] hover:border-[var(--color-accent-bright)]",
  secondary:
    "border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] " +
    "hover:border-[var(--color-text)] hover:bg-[var(--color-paper)]",
  danger:
    "border-[var(--color-danger)] bg-transparent text-[var(--color-danger)] " +
    "hover:bg-[var(--color-danger-bg)]",
  ghost:
    "border-transparent bg-transparent text-[var(--color-text-muted)] " +
    "hover:text-[var(--color-text)] hover:bg-[var(--color-paper)]",
};

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
