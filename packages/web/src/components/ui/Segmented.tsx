"use client";

/**
 * Selector tipo "tab bar" para elegir entre N opciones predefinidas.
 * Mismo estilo en /positions/[mint] (configure form) y en /settings.
 * Mantiene los valores como strings; el caller convierte al tipo final.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap rounded-xl overflow-hidden border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]">
      {options.map((opt, i) => {
        const active = value === opt.value;
        const disabled = opt.disabled === true;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (disabled) return;
              onChange(opt.value);
            }}
            disabled={disabled}
            title={opt.title}
            aria-disabled={disabled}
            className={`px-4 py-2 t-eyebrow transition-colors ${
              i > 0 ? "border-l border-[var(--color-hairline)]" : ""
            } ${
              disabled
                ? "text-[var(--color-text-dim)] cursor-not-allowed"
                : active
                  ? "bg-[var(--color-accent-dim)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
