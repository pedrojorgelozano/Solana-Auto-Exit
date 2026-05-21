"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { en } from "./en";
import { es } from "./es";

export type Lang = "en" | "es";
type Dict = typeof en;

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const STORAGE_KEY = "auto-exit:lang";

const LangContext = createContext<LangContextValue | null>(null);

/**
 * Detecta el idioma inicial:
 *  1. Lo que tenga el usuario en localStorage (preferencia explícita).
 *  2. Si no, navigator.language. Si empieza por "es" → español.
 *  3. Fallback: inglés.
 *
 * Esta función corre solo en cliente — el SSR cae al default y el primer
 * render del cliente puede hidratar con otro idioma (hidration mismatch).
 * Para evitar el flash, leemos localStorage de forma síncrona en
 * useState's initializer y dejamos que el primer render ya use el
 * idioma correcto.
 */
function detectInitial(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
  } catch {
    /* localStorage bloqueado (modo privado en algunos navegadores) */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  return nav.toLowerCase().startsWith("es") ? "es" : "en";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage bloqueado — la preferencia no persiste */
    }
  }, []);

  // Mantén el atributo lang del <html> sincronizado para accesibilidad
  // (lectores de pantalla y herramientas auto-traductoras como las del
  // browser usan este atributo).
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t: lang === "es" ? es : en }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/**
 * Hook principal. Devuelve `t` (diccionario con autocomplete TS),
 * `lang` (current) y `setLang` (toggle).
 */
export function useT(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useT must be used inside <LangProvider>");
  }
  return ctx;
}
