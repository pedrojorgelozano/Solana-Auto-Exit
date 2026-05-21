/**
 * Time-buffer state machine (ADR-025) extraído como función pura.
 *
 * El watcher evalúa, en cada tick, si un trigger (take-profit o stop-loss)
 * debe disparar el cierre. Con time-buffer configurado, exigimos que el
 * precio se mantenga en zona durante `bufferMs` continuos antes de
 * disparar. Reset duro: si en un tick el precio sale de la zona, el
 * cronómetro vuelve a null y el siguiente cruce reinicia desde cero.
 *
 * Razones para extraerlo del TaskManager:
 *  - El cuerpo es pura lógica de estado: testeable sin DB, sin RPC, sin
 *    AbortController, sin mocks.
 *  - El emisor de eventos (history) se desacopla: el caller decide cómo
 *    persistir los events (`armed` / `reset`). En el watcher mantienen
 *    el contrato actual con appendHistory.
 */

export type TriggerKind = "take_profit" | "stop_loss";

/**
 * Estado mutable del cronómetro por trigger. El watcher mantiene un
 * `RunningEntry` con estos dos campos; el evaluador los lee y los muta.
 */
export interface BufferState {
  tpFirstCrossedAt: number | null;
  slFirstCrossedAt: number | null;
}

/**
 * Evento que el evaluador emite para que el caller lo persista. `null`
 * significa que el tick no produjo cambio observable (ni se armó ni se
 * reseteó el cronómetro).
 */
export type BufferEvent =
  | { kind: "armed"; trigger: TriggerKind; bufferMs: number }
  | { kind: "reset"; trigger: TriggerKind };

export interface EvalBufferResult {
  /** true = el trigger debe disparar el cierre en este tick. */
  ready: boolean;
  /** Evento a registrar en history, o null si no hay cambio. */
  event: BufferEvent | null;
}

/**
 * Pure function. Muta el slot correspondiente en `state` y devuelve
 * `{ ready, event }`. Casos:
 *
 *  - inZone=true, sin buffer (null o ≤ 0) → ready=true, sin evento.
 *  - inZone=true, buffer sin cronómetro vivo → arma cronómetro, ready=false,
 *    evento "armed".
 *  - inZone=true, buffer + cronómetro vivo → ready si `now - first ≥ buffer`,
 *    sin evento.
 *  - inZone=false, cronómetro vivo → reset, ready=false, evento "reset".
 *  - inZone=false, sin cronómetro → ready=false, sin evento (no-op).
 */
export function evalBuffer(
  state: BufferState,
  trigger: TriggerKind,
  inZone: boolean,
  bufferMs: number | null,
  now: number,
): EvalBufferResult {
  const slot: keyof BufferState =
    trigger === "take_profit" ? "tpFirstCrossedAt" : "slFirstCrossedAt";
  const current = state[slot];

  if (!inZone) {
    if (current !== null) {
      state[slot] = null;
      return { ready: false, event: { kind: "reset", trigger } };
    }
    return { ready: false, event: null };
  }

  // En zona.
  if (bufferMs === null || bufferMs <= 0) {
    return { ready: true, event: null };
  }

  if (current === null) {
    state[slot] = now;
    return { ready: false, event: { kind: "armed", trigger, bufferMs } };
  }

  return { ready: now - current >= bufferMs, event: null };
}
