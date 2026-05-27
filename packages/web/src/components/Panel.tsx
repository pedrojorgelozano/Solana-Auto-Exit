import type { ReactNode } from "react";

/**
 * Panel del rediseño "refined minimal dark". Patrón del mockup `.panel`:
 * border + surface elevada + head con icono+título+descripción y body con
 * padding interior. Sustituye al patrón antiguo eyebrow + h2 + section
 * sin contenedor.
 */
export function Panel({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[11px] border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)]">
      <div className="flex items-center gap-3 border-b border-[var(--color-hairline)] px-[22px] py-[18px]">
        {icon ? (
          <span
            className="
              grid h-[30px] w-[30px] flex-none place-items-center rounded-lg
              border border-[var(--color-accent)]/20 bg-[var(--color-accent-dim)]
              text-[var(--color-accent)]
            "
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight tracking-tight">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-[14px] text-[var(--color-text-dim)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="px-[22px] pb-5 pt-2">{children}</div>
    </section>
  );
}
