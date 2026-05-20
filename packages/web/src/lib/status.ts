/**
 * Mapeo entre estados del backend y vocabulario de UI. Los status del
 * server (armed, triggered, closing, done, paused, error, stopped, idle)
 * son nombres de máquina de estados; los del usuario son frases que
 * comunican qué pasa.
 */

export type BackendStatus =
  | "idle"
  | "armed"
  | "triggered"
  | "closing"
  | "done"
  | "error"
  | "paused"
  | "stopped";

export type StatusTone = "neutral" | "active" | "warning" | "positive" | "danger";

export interface StatusView {
  label: string;
  tone: StatusTone;
  description: string;
  /** ¿Está "trabajando" ahora mismo (pulsa el dot)? */
  pulsing: boolean;
}

const VIEWS: Record<BackendStatus, StatusView> = {
  idle: {
    label: "Ready",
    tone: "neutral",
    description: "Configured but not watching yet.",
    pulsing: false,
  },
  armed: {
    label: "Watching",
    tone: "active",
    description: "Polling the pool for the trigger condition.",
    pulsing: true,
  },
  triggered: {
    label: "Target hit",
    tone: "warning",
    description: "Trigger condition met. Preparing the close.",
    pulsing: true,
  },
  closing: {
    label: "Closing position",
    tone: "warning",
    description:
      "Sending the close (and swap, if configured). This takes a few seconds.",
    pulsing: true,
  },
  done: {
    label: "Completed",
    tone: "positive",
    description: "Closed cleanly. See the result below.",
    pulsing: false,
  },
  error: {
    label: "Stopped — error",
    tone: "danger",
    description: "Something went wrong. See details below.",
    pulsing: false,
  },
  paused: {
    label: "Paused",
    tone: "neutral",
    description: "Not watching. Resume to continue.",
    pulsing: false,
  },
  stopped: {
    label: "Stopped",
    tone: "neutral",
    description: "Stopped by the user.",
    pulsing: false,
  },
};

export function statusView(status: BackendStatus | string): StatusView {
  return VIEWS[status as BackendStatus] ?? VIEWS.idle;
}

/** Mapeo de tone a clases Tailwind (colores ya definidos en globals.css). */
export const TONE_CLASSES: Record<
  StatusTone,
  { dot: string; text: string; bg: string; border: string }
> = {
  neutral: {
    dot: "bg-[var(--color-text-muted)]",
    text: "text-[var(--color-text-muted)]",
    bg: "bg-[var(--color-text-muted)]/10",
    border: "border-[var(--color-text-muted)]/30",
  },
  active: {
    dot: "bg-[var(--color-positive)]",
    text: "text-[var(--color-positive)]",
    bg: "bg-[var(--color-positive-bg)]",
    border: "border-[var(--color-positive)]/40",
  },
  warning: {
    dot: "bg-[var(--color-warning)]",
    text: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning-bg)]",
    border: "border-[var(--color-warning)]/40",
  },
  positive: {
    dot: "bg-[var(--color-positive)]",
    text: "text-[var(--color-positive)]",
    bg: "bg-[var(--color-positive-bg)]",
    border: "border-[var(--color-positive)]/40",
  },
  danger: {
    dot: "bg-[var(--color-danger)]",
    text: "text-[var(--color-danger)]",
    bg: "bg-[var(--color-danger-bg)]",
    border: "border-[var(--color-danger)]/40",
  },
};
