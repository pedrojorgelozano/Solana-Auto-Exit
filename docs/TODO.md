# TODO

## En curso

- [ ] Validar end-to-end la feature `EXIT_TOKEN_MINT` en devnet. Pasos:
  1. Reabrir posición SOL/devUSDC out-of-range (mismo patrón: rango 25–30, 0.1 SOL).
  2. Editar `.env`: `EXIT_TOKEN_MINT=BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k` (devUSDC).
  3. Primera pasada con `DRY_RUN=true` para ver el quote del swap.
  4. Segunda pasada con `DRY_RUN=false` para cerrar + swapear de verdad.
  5. Verificar por RPC que el ATA de devUSDC tiene balance positivo y el saldo SOL refleja fees.

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

Ver [PROGRESS.md](PROGRESS.md). Fase 1 completa, feature auto-swap implementada (typecheck OK, sin validación E2E aún).
