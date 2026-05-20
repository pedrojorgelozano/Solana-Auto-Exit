import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";

/**
 * Sistema tipográfico de 3 fonts:
 * - Display: Fraunces variable (opsz + SOFT axes), serif con carácter editorial.
 * - Body: Instrument Sans, sans con personalidad pero no estridente.
 * - Mono: JetBrains Mono con tabular nums para números/addresses.
 */

export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
