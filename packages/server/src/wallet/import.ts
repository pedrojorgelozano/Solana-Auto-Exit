/**
 * Helpers para convertir distintos formatos de clave privada de Solana
 * (lo que el usuario tenga: base58 estilo Phantom, array JSON estilo CLI)
 * a los 64 bytes que necesita el SDK.
 */

import { getBase58Codec } from "@solana/kit";

/**
 * Lee bytes de una clave privada en formato base58 (88 caracteres normalmente).
 * Es el formato que Phantom/Backpack muestran al exportar.
 */
export function bytesFromBase58(input: string): Uint8Array {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty base58 input.");
  let bytes: Uint8Array;
  try {
    bytes = getBase58Codec().encode(trimmed) as Uint8Array;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid base58 string: ${detail}`);
  }
  if (bytes.length !== 64) {
    throw new Error(
      `Expected 64 bytes from base58 (got ${bytes.length}). ` +
        `Make sure you copied the full secret key, not just the public address.`,
    );
  }
  return bytes;
}

/**
 * Lee bytes de un array JSON estilo Solana CLI (formato wallet.json).
 * Ejemplo: "[12, 45, 200, ..., 8]" con exactamente 64 enteros 0..255.
 */
export function bytesFromJsonArray(input: string): Uint8Array {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON: ${detail}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array of 64 integers.");
  }
  if (parsed.length !== 64) {
    throw new Error(
      `Expected 64 integers in the array, got ${parsed.length}.`,
    );
  }
  for (const v of parsed) {
    if (
      typeof v !== "number" ||
      !Number.isInteger(v) ||
      v < 0 ||
      v > 255
    ) {
      throw new Error(
        "JSON array must contain only integers in 0..255.",
      );
    }
  }
  return new Uint8Array(parsed as number[]);
}
