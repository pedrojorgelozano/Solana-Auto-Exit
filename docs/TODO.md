# TODO

## En curso

(nada activo)

## Próximo

- [ ] Fase 2 — adapter de Meteora DLMM. Antes de tocar código verificar el SDK actual en `https://docs.meteora.ag/` y `https://github.com/MeteoraAg/dlmm-sdk`. Confirmar compatibilidad con `@solana/kit@^5` o decidir cómo conviven los stacks.

## Backlog

- [ ] Cierre + swap atómico en una sola tx (combinar `closePositionInstructions` + `swapInstructions` + `buildAndSendTransaction` de `@orca-so/tx-sender`). Elimina el riesgo de slippage entre las dos tx.
- [ ] Anti-flapping: confirmar el trigger durante N ciclos antes de cerrar (evita disparos por ticks ruidosos).
- [ ] Persistencia de estado entre reinicios (útil sobre todo cuando haya múltiples posiciones).
- [ ] Soporte de múltiples posiciones simultáneas (hoy 1 posición por proceso).
- [ ] Métricas/observabilidad: logs estructurados (JSON), opción de exportar a fichero rotado o Prometheus.
- [ ] `EXIT_TOKEN_MINT` con tokens FUERA del pool (vía Jupiter en mainnet, multi-hop). Hoy solo mismo pool (ADR-008).
- [ ] Tests automatizados: hoy 0. Empezar por `env.ts`, `retry.ts`, `loop.ts` con `node:test` o `vitest`.
- [ ] Convertir el proyecto en repo git y empezar a versionar.
- [ ] Manejo explícito de buffer de fees al swapear SOL nativo (hoy delegamos al `nativeMintWrappingStrategy` por defecto del SDK; revisar edge case con balances muy justos).

## Hecho recientemente

Ver [PROGRESS.md](PROGRESS.md).

- Fase 1 completa (núcleo + adapter Orca v8, validada E2E en devnet).
- Feature `EXIT_TOKEN_MINT` implementada y **validada E2E** en devnet con dos txs reales (close + swap, ver entrada del 2026-05-20).
- Script `scripts/inspect-pool.ts` para consultar mints y parámetros de un pool Whirlpool.
