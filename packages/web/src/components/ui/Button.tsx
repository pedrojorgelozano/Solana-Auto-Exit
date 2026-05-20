import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "default" | "sm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * Botones editoriales: cuadrados con un radius mínimo, label en sans con
 * letterspacing wide, sin sombras. El primario tiene relleno oxblood;
 * los demás son outlines en hairline. Hover invierte/refuerza, no "levita".
 */
const base =
  "inline-flex items-center justify-center gap-2 border transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none";

const sizes: Record<Size, string> = {
  default: "h-10 px-5 text-[0.8125rem] tracking-wider uppercase rounded-[2px]",
  sm: "h-8 px-3 text-[0.6875rem] tracking-wider uppercase rounded-[2px]",
};

const variants: Record<Variant, string> = {
  primary:
    "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-bright)] hover:border-[var(--color-accent-bright)]",
  secondary:
    "border-[var(--color-border-strong)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-text)] hover:bg-white/5",
  danger:
    "border-[var(--color-danger)] bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]",
  ghost:
    "border-transparent bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
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
