import { Fraunces, Source_Serif_4, JetBrains_Mono } from "next/font/google";

/**
 * Sistema tipográfico "Light cuaderno" (supera ADR-017):
 * - Display: Fraunces variable (opsz axis), serif con personalidad para los
 *   titulares grandes. Conservada de la dirección anterior.
 * - Body: Source Serif 4 — serif limpio y muy legible diseñado para texto
 *   largo. Sustituye a Instrument Sans para reforzar el "feel cuaderno"
 *   sin perder legibilidad en cuerpos a 16-17 px.
 * - Mono: JetBrains Mono con tabular nums para addresses Solana y números
 *   donde la alineación importa.
 */

export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
  display: "swap",
});

export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
