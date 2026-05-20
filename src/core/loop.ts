import { setTimeout as sleep } from "node:timers/promises";
import { logError } from "./logger.js";

export type TickResult = "continue" | "stop";

export interface LoopOptions {
  pollMs: number;
  tick: () => Promise<TickResult>;
}

export async function loop(opts: LoopOptions): Promise<void> {
  while (true) {
    let result: TickResult;
    try {
      result = await opts.tick();
    } catch (err) {
      logError("tick falló (se reintenta en el siguiente ciclo)", err);
      result = "continue";
    }
    if (result === "stop") return;
    await sleep(opts.pollMs);
  }
}
