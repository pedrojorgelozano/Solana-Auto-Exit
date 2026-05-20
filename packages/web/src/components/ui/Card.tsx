import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "danger";
}

export function Card({ variant = "default", className = "", ...rest }: Props) {
  const border =
    variant === "danger"
      ? "border-[var(--color-danger)]/40"
      : "border-[var(--color-border)]";
  return (
    <div
      className={`rounded-xl border ${border} bg-[var(--color-bg-elevated)] p-6 ${className}`}
      {...rest}
    />
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-sm text-[var(--color-danger)]">{children}</p>
  );
}
