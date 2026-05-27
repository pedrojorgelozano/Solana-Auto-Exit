import { Newsreader, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";

/**
 * Sistema tipográfico "Refined minimal dark":
 * - Body / headings: Hanken Grotesk (sans humanista, peso 400–700). Es la
 *   fuente primaria, en `font-body`. Headings <h1>–<h4> son sans bold, no
 *   serif — el mockup usa peso 700 con tracking negativo.
 * - Display / accent: Newsreader italic (axes opsz). Usado solo para los
 *   acentos editoriales `.serif-it` ("around the clock"), no para
 *   titulares. Vive en `font-display` por compatibilidad con el resto del
 *   árbol que no debe cambiarse, pero conceptualmente es "accent".
 * - Mono: Spline Sans Mono con tabular nums (.num / .t-num) para números
 *   y direcciones — variant ligeramente más cálido que JetBrains Mono.
 */

export const fraunces = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
  style: ["italic"],
  display: "swap",
});

export const sourceSerif = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const jetbrainsMono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});
