import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90",
  secondary:
    "border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] hover:bg-white/5",
  danger:
    "border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20",
  ghost:
    "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
};

export function Button({ variant = "primary", className = "", ...rest }: Props) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
