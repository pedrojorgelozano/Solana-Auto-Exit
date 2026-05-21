/**
 * Defensa anti-bruteforce para `wallet.unlock`.
 *
 * Modelo de amenaza: malware local (u otro proceso con acceso a la API tRPC
 * en localhost) intenta adivinar la passphrase del vault. scrypt(N=32768) ya
 * hace cada intento caro (~100ms en hardware moderno), pero un loop sin
 * pausa puede igualmente atacar passphrases débiles si hay tiempo.
 *
 * Política: ventana deslizante de 5 minutos, máximo 5 intentos fallidos.
 * Al sexto intento dentro de la ventana, rechazamos con un error tipo 429
 * sin tocar el vault. Un unlock exitoso resetea el contador.
 *
 * Diseño in-memory + global (no por IP):
 *  - El bot es single-user self-hosted con bind localhost; "todos los
 *    clientes" son siempre el mismo. Un Map<ip, ...> daría idéntico
 *    resultado con más código.
 *  - In-memory significa que un reinicio del server resetea la cuenta. Es
 *    consciente: si un atacante consigue reiniciar el server entre intentos,
 *    ya tiene control de la máquina y el vault está perdido por otras vías
 *    (proceso debugger, scraping de /data/wallet.vault, etc.).
 *  - 5 intentos / 5 min es la fricción mínima útil: usuario legítimo que se
 *    equivoca 4 veces seguidas no se queda bloqueado; bruteforce serio se
 *    ralentiza a 12 intentos/hora.
 *
 * No es contra-medida exhaustiva. Defensa-en-profundidad junto a scrypt +
 * passphrase fuerte.
 */
export interface UnlockLimitState {
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly windowMs: number;
  readonly lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;

interface InternalState {
  failedAt: number[];
}

const state: InternalState = { failedAt: [] };

function prune(now: number): void {
  const cutoff = now - WINDOW_MS;
  state.failedAt = state.failedAt.filter((t) => t > cutoff);
}

/**
 * Llamar ANTES del unlock. Throws si está bloqueado. El mensaje incluye los
 * segundos que faltan para el próximo intento permitido, para que la UI
 * pueda mostrarlo al usuario.
 */
export function assertUnlockAllowed(now: number = Date.now()): void {
  prune(now);
  if (state.failedAt.length < MAX_ATTEMPTS) return;
  // failedAt está ordenado cronológicamente; el más antiguo dentro de la
  // ventana define cuándo se libera el siguiente slot.
  const oldest = state.failedAt[0]!;
  const waitMs = oldest + WINDOW_MS - now;
  const waitSec = Math.max(1, Math.ceil(waitMs / 1000));
  const err: Error & { code?: string } = new Error(
    `Too many failed unlock attempts. Try again in ${waitSec}s.`,
  );
  err.code = "RATE_LIMITED";
  throw err;
}

/** Llamar tras un unlock fallido (passphrase incorrecta). */
export function recordUnlockFailure(now: number = Date.now()): void {
  prune(now);
  state.failedAt.push(now);
}

/** Llamar tras un unlock exitoso. Resetea el contador. */
export function recordUnlockSuccess(): void {
  state.failedAt = [];
}

/** Estado consultable (útil para tests o telemetría). */
export function getUnlockLimitState(now: number = Date.now()): UnlockLimitState {
  prune(now);
  return {
    attempts: state.failedAt.length,
    maxAttempts: MAX_ATTEMPTS,
    windowMs: WINDOW_MS,
    lockedUntil:
      state.failedAt.length >= MAX_ATTEMPTS
        ? state.failedAt[0]! + WINDOW_MS
        : null,
  };
}
