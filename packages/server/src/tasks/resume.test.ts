import { describe, it, expect } from "vitest";
import {
  isSystemPaused,
  evaluateTriggerCross,
  VAULT_LOCKED_MESSAGE,
  SERVER_RESTART_MESSAGE,
} from "./resume.js";

describe("isSystemPaused", () => {
  it("reconoce los mensajes de pausa por sistema", () => {
    expect(isSystemPaused(VAULT_LOCKED_MESSAGE)).toBe(true);
    expect(isSystemPaused(SERVER_RESTART_MESSAGE)).toBe(true);
  });

  it("los reconoce aunque vengan como substring de un mensaje mayor", () => {
    expect(isSystemPaused(`${VAULT_LOCKED_MESSAGE} (task abc)`)).toBe(true);
  });

  it("null (pausa de usuario) no es system-paused", () => {
    expect(isSystemPaused(null)).toBe(false);
  });

  it("un error no relacionado no es system-paused", () => {
    expect(isSystemPaused("rpc timeout after close attempt")).toBe(false);
  });
});

describe("evaluateTriggerCross", () => {
  it("TP: cruza con price >= takeProfitPrice", () => {
    expect(evaluateTriggerCross(100, 100, null)).toEqual({
      crossed: true,
      crossedBy: "take_profit",
    });
    expect(evaluateTriggerCross(101, 100, null)).toEqual({
      crossed: true,
      crossedBy: "take_profit",
    });
    expect(evaluateTriggerCross(99, 100, null)).toEqual({
      crossed: false,
      crossedBy: null,
    });
  });

  it("SL: cruza con price <= stopLossPrice", () => {
    expect(evaluateTriggerCross(50, null, 50)).toEqual({
      crossed: true,
      crossedBy: "stop_loss",
    });
    expect(evaluateTriggerCross(49, null, 50)).toEqual({
      crossed: true,
      crossedBy: "stop_loss",
    });
    expect(evaluateTriggerCross(51, null, 50)).toEqual({
      crossed: false,
      crossedBy: null,
    });
  });

  it("con TP y SL definidos, el precio dentro del rango no cruza nada", () => {
    // TP=120, SL=80, price=100 → dentro del rango operativo.
    expect(evaluateTriggerCross(100, 120, 80)).toEqual({
      crossed: false,
      crossedBy: null,
    });
  });

  it("con TP y SL definidos, prioriza take-profit al cruzar por arriba", () => {
    expect(evaluateTriggerCross(130, 120, 80)).toEqual({
      crossed: true,
      crossedBy: "take_profit",
    });
  });

  it("con TP y SL definidos, detecta stop-loss al cruzar por abajo", () => {
    expect(evaluateTriggerCross(70, 120, 80)).toEqual({
      crossed: true,
      crossedBy: "stop_loss",
    });
  });

  it("precio null o no finito nunca cruza", () => {
    expect(evaluateTriggerCross(null, 100, 50)).toEqual({
      crossed: false,
      crossedBy: null,
    });
    expect(evaluateTriggerCross(Number.NaN, 100, 50)).toEqual({
      crossed: false,
      crossedBy: null,
    });
    expect(evaluateTriggerCross(Number.POSITIVE_INFINITY, 100, 50)).toEqual({
      crossed: false,
      crossedBy: null,
    });
  });

  it("sin triggers definidos nunca cruza", () => {
    expect(evaluateTriggerCross(100, null, null)).toEqual({
      crossed: false,
      crossedBy: null,
    });
  });
});
