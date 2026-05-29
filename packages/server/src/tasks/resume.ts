/**
 * Lógica pura del "resume seguro" tras desbloquear la wallet.
 *
 * Cuando la wallet se bloquea (manual o por reinicio del server), el watcher
 * pausa las tasks activas. Al desbloquear, el dashboard ofrece reanudarlas.
 * El problema: si el precio cruzó el trigger de una task MIENTRAS estaba
 * pausada, reanudarla dispara un cierre inmediato (sin buffer) o tras el
 * buffer — el usuario no eligió eso, el mercado se movió a sus espaldas.
 *
 * Este módulo aísla las dos piezas puras (sin red ni DB) para poder testearlas:
 *  - `isSystemPaused`: ¿esta task se pausó por sistema (no por el usuario)?
 *  - `evaluateTriggerCross`: dado el precio actual, ¿cruzó algún trigger?
 *
 * La evaluación con I/O (fetch del precio por task) vive en
 * `TaskManager.evaluateResumeCandidates`, que usa estos helpers.
 */

/**
 * Mensajes exactos que el watcher escribe en `lastError` al pausar por sistema.
 * Centralizados aquí (en vez de duplicados como literales en `manager.ts` y en
 * el cliente) para que la heurística de detección no derive del origen.
 * `manager.ts` los importa al escribir; la detección los compara por inclusión.
 */
export const VAULT_LOCKED_MESSAGE = "Vault was locked while running.";
export const SERVER_RESTART_MESSAGE =
  "Server restarted; resume after unlocking the vault.";

const SYSTEM_PAUSE_MARKERS = [VAULT_LOCKED_MESSAGE, SERVER_RESTART_MESSAGE];

/**
 * ¿La task se pausó por sistema (vault-lock / reinicio) y no porque el usuario
 * pulsara Pause a propósito? No hay un campo `pausedReason` persistido, así que
 * la heurística es el contenido de `lastError`. Las pausas de usuario no
 * escriben `lastError`, así que un null nunca es system-paused.
 */
export function isSystemPaused(lastError: string | null): boolean {
  if (!lastError) return false;
  return SYSTEM_PAUSE_MARKERS.some((m) => lastError.includes(m));
}

export type CrossedBy = "take_profit" | "stop_loss";

/**
 * Dado el precio actual y los triggers de una task, ¿está el precio dentro de
 * la zona de disparo de alguno? Mismas semánticas que el watcher
 * (`manager.runWatcher`): TP dispara con `price >= takeProfitPrice`, SL con
 * `price <= stopLossPrice`. Si por construcción ambos cupieran (no puede:
 * la validación exige TP > SL), priorizamos take-profit como el watcher.
 *
 * NO mira el time-buffer: un trigger con buffer no dispara en el primer tick,
 * pero SÍ dispara si el precio se mantiene en zona durante el buffer. Para la
 * decisión de seguridad nos quedamos con lo conservador: si está en zona, hay
 * que revisar. El buffer solo amortigua, no elimina el riesgo.
 */
export function evaluateTriggerCross(
  price: number | null,
  takeProfitPrice: number | null,
  stopLossPrice: number | null,
): { crossed: boolean; crossedBy: CrossedBy | null } {
  if (price === null || !Number.isFinite(price)) {
    return { crossed: false, crossedBy: null };
  }
  if (takeProfitPrice !== null && price >= takeProfitPrice) {
    return { crossed: true, crossedBy: "take_profit" };
  }
  if (stopLossPrice !== null && price <= stopLossPrice) {
    return { crossed: true, crossedBy: "stop_loss" };
  }
  return { crossed: false, crossedBy: null };
}

/**
 * Resultado por task del análisis de resume. Serializable (lo devuelve un
 * endpoint tRPC). `currentPrice === null` + `priceError` ≠ null significa que
 * no se pudo leer el precio — el cliente lo trata como "revisar" (nunca como
 * "seguro"): solo es seguro reanudar si hay precio real y NO cruzó.
 */
export interface ResumeCandidate {
  id: string;
  /** Label legible del par ("SOL / devUSDC") o el positionId si no se resolvió. */
  label: string;
  currentPrice: number | null;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  crossed: boolean;
  crossedBy: CrossedBy | null;
  priceError: string | null;
}
