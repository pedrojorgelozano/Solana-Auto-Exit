import { describe, it, expect } from "vitest";
import { evalBuffer, type BufferState } from "./buffer.js";

function freshState(): BufferState {
  return { tpFirstCrossedAt: null, slFirstCrossedAt: null };
}

describe("evalBuffer state machine (ADR-025)", () => {
  it("in-zone without buffer fires immediately", () => {
    const s = freshState();
    const r = evalBuffer(s, "take_profit", true, null, 1000);
    expect(r.ready).toBe(true);
    expect(r.event).toBeNull();
    expect(s.tpFirstCrossedAt).toBeNull(); // no arma cronómetro
  });

  it("in-zone with buffer=0 also fires immediately (sin buffer efectivo)", () => {
    const s = freshState();
    const r = evalBuffer(s, "take_profit", true, 0, 1000);
    expect(r.ready).toBe(true);
    expect(r.event).toBeNull();
  });

  it("in-zone with buffer arms the timer on first tick, does NOT fire", () => {
    const s = freshState();
    const r = evalBuffer(s, "take_profit", true, 60_000, 1000);
    expect(r.ready).toBe(false);
    expect(r.event).toEqual({
      kind: "armed",
      trigger: "take_profit",
      bufferMs: 60_000,
    });
    expect(s.tpFirstCrossedAt).toBe(1000);
  });

  it("in-zone with buffer + active timer keeps waiting under threshold", () => {
    const s: BufferState = { tpFirstCrossedAt: 1000, slFirstCrossedAt: null };
    const r = evalBuffer(s, "take_profit", true, 60_000, 30_000);
    expect(r.ready).toBe(false);
    expect(r.event).toBeNull();
    expect(s.tpFirstCrossedAt).toBe(1000); // sin mutar
  });

  it("in-zone with buffer fires when elapsed ≥ bufferMs", () => {
    const s: BufferState = { tpFirstCrossedAt: 1000, slFirstCrossedAt: null };
    const r = evalBuffer(s, "take_profit", true, 60_000, 61_000);
    expect(r.ready).toBe(true);
    expect(r.event).toBeNull();
  });

  it("in-zone with buffer fires at exactly bufferMs elapsed (boundary)", () => {
    const s: BufferState = { tpFirstCrossedAt: 1000, slFirstCrossedAt: null };
    const r = evalBuffer(s, "take_profit", true, 60_000, 61_000);
    expect(r.ready).toBe(true);
  });

  it("out-of-zone resets the active timer (hard reset)", () => {
    const s: BufferState = { tpFirstCrossedAt: 1000, slFirstCrossedAt: null };
    const r = evalBuffer(s, "take_profit", false, 60_000, 30_000);
    expect(r.ready).toBe(false);
    expect(r.event).toEqual({ kind: "reset", trigger: "take_profit" });
    expect(s.tpFirstCrossedAt).toBeNull();
  });

  it("out-of-zone without an active timer is a noop (no event)", () => {
    const s = freshState();
    const r = evalBuffer(s, "take_profit", false, 60_000, 1000);
    expect(r.ready).toBe(false);
    expect(r.event).toBeNull();
  });

  it("TP and SL slots are independent", () => {
    const s = freshState();
    evalBuffer(s, "take_profit", true, 60_000, 1000);
    evalBuffer(s, "stop_loss", false, 60_000, 1000);
    expect(s.tpFirstCrossedAt).toBe(1000);
    expect(s.slFirstCrossedAt).toBeNull();
  });

  it("SL trigger arms its own slot on first cross", () => {
    const s = freshState();
    const r = evalBuffer(s, "stop_loss", true, 30_000, 2000);
    expect(r.ready).toBe(false);
    expect(r.event).toEqual({
      kind: "armed",
      trigger: "stop_loss",
      bufferMs: 30_000,
    });
    expect(s.slFirstCrossedAt).toBe(2000);
    expect(s.tpFirstCrossedAt).toBeNull();
  });

  it("full sequence: arm → wait → reset → arm again from zero", () => {
    const s = freshState();
    // Tick 1: precio cruza, arma.
    expect(evalBuffer(s, "take_profit", true, 60_000, 1000).event).toEqual({
      kind: "armed",
      trigger: "take_profit",
      bufferMs: 60_000,
    });
    // Tick 2: precio sale de zona, reset.
    expect(evalBuffer(s, "take_profit", false, 60_000, 30_000).event).toEqual({
      kind: "reset",
      trigger: "take_profit",
    });
    expect(s.tpFirstCrossedAt).toBeNull();
    // Tick 3: vuelve a cruzar, arma desde cero (no desde el original).
    const r3 = evalBuffer(s, "take_profit", true, 60_000, 60_000);
    expect(r3.event).toEqual({
      kind: "armed",
      trigger: "take_profit",
      bufferMs: 60_000,
    });
    expect(s.tpFirstCrossedAt).toBe(60_000);
    // Tick 4: a t=120_000 ya pasaron 60s desde el segundo arme → ready.
    expect(evalBuffer(s, "take_profit", true, 60_000, 120_000).ready).toBe(true);
  });

  it("negative bufferMs is treated as no-buffer (immediate fire)", () => {
    const s = freshState();
    const r = evalBuffer(s, "take_profit", true, -5, 1000);
    expect(r.ready).toBe(true);
    expect(r.event).toBeNull();
  });
});
