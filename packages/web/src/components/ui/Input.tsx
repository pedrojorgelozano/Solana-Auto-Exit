import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Inputs sin "pill": solo bottom-border. En focus la línea se vuelve oxblood.
 * Tamaño grande, fuente body. Para números, añadir className="t-num".
 */

const inputBase =
  "w-full bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] " +
  "border-b border-[var(--color-hairline)] focus:border-[var(--color-accent-bright)] " +
  "px-0 py-2 transition-colors duration-150 outline-none rounded-none";

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`${inputBase} text-base ${className}`}
      {...rest}
    />
  );
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${inputBase} resize-y font-[var(--font-mono)] text-xs leading-relaxed ${className}`}
      {...rest}
    />
  );
}

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between">
      <span className="t-eyebrow">{children}</span>
      {hint ? (
        <span className="text-[0.6875rem] font-[var(--font-mono)] text-[var(--color-text-dim)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
