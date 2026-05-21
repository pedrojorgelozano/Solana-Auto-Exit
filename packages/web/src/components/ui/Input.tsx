"use client";

import { useState } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Inputs "Light cuaderno": campo de papel con borde discreto, foco
 * marcado en terracota. Altura 44 px mínimo (touch target accesible).
 */

const inputBase =
  "w-full bg-[var(--color-bg-elevated)] text-[var(--color-text)] " +
  "placeholder:text-[var(--color-text-dim)] " +
  "border border-[var(--color-border-strong)] " +
  "focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-dim)] " +
  "rounded-lg px-3.5 py-2.5 transition-colors duration-150 outline-none";

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`${inputBase} text-base min-h-11 ${className}`}
      {...rest}
    />
  );
}

/**
 * Input enmascarado con toggle de mostrar/ocultar. Mismo styling que `Input`
 * pero el campo ocupa `pr-12` para reservar espacio al botón del ojo (que
 * vive absoluto a la derecha). El botón conmuta entre `type="password"` y
 * `type="text"`; el resto de props se propagan tal cual al `<input>`.
 */
export function PasswordInput({
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <input
        type={revealed ? "text" : "password"}
        className={`${inputBase} text-base min-h-11 pr-12 ${className}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "Hide" : "Show"}
        aria-pressed={revealed}
        title={revealed ? "Hide" : "Show"}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-paper)] focus-visible:text-[var(--color-text)] transition-colors"
      >
        {revealed ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${inputBase} resize-y font-[var(--font-mono)] text-sm leading-relaxed ${className}`}
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
      className="mb-2 flex items-baseline justify-between gap-3"
    >
      <span className="t-eyebrow">{children}</span>
      {hint ? (
        <span className="text-xs font-[var(--font-mono)] text-[var(--color-text-muted)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
