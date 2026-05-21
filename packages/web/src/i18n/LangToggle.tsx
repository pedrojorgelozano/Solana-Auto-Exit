"use client";

import { useT } from "./context";

/**
 * Toggle de idioma en el header global. Texto "EN" / "ES" en lugar de
 * un icono (la bandera de país no aplica bien a "español" o "inglés"
 * como idiomas universales). Hover: bg-paper. Click: conmuta + persiste
 * en localStorage.
 */
export function LangToggle() {
  const { lang, setLang, t } = useT();
  const next = lang === "en" ? "es" : "en";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={t.header.languageToggle}
      title={
        lang === "en" ? "Switch to Spanish · ES" : "Cambiar a inglés · EN"
      }
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-paper)] transition-colors"
    >
      {lang.toUpperCase()}
    </button>
  );
}
