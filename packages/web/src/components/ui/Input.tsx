import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const inputBase =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none";

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} ${className}`} {...rest} />;
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${inputBase} resize-y font-mono text-xs ${className}`}
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
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs uppercase tracking-wider text-[var(--color-text-muted)]"
    >
      <span>{children}</span>
      {hint ? (
        <span className="ml-2 text-[10px] normal-case tracking-normal text-[var(--color-text-muted)]/70">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
