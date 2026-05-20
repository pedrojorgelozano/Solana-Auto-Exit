# Registros de decisiones arquitectónicas (ADR)

## ADR-001 — Adapter pattern: núcleo agnóstico + un módulo por protocolo

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: El proyecto debe soportar múltiples protocolos DeFi de Solana (Orca primero, Meteora después, otros posiblemente). Cada protocolo tiene SDK distinto, conceptos distintos para "posición" y forma distinta de leer precio y cerrar.

**Decisión**: Núcleo en `src/core/` no sabe nada de ningún SDK específico. Cada protocolo es un módulo en `src/protocols/<name>/` que implementa el contrato `ProtocolAdapter` (en `src/protocols/types.ts`). El runner del núcleo orquesta `init → resolvePosition → loop(getPrice) → closePosition → swapToExit`.

**Consecuencias**:
- (+) Añadir un protocolo nuevo = escribir un adapter + entrada en el registry. El núcleo no se toca.
- (+) Loop, retry, logging, validación de env y safety net mainnet son comunes y se prueban una sola vez.
- (−) El contrato fuerza un mínimo común denominador. Primitivas específicas del protocolo (rebalanceos, harvest selectivo, etc.) tendrán que ir como métodos opcionales o extensiones.

**Alternativas consideradas**: Script monolítico por protocolo (lo que era `orca-auto-exit.ts`). Descartada por obligar a reimplementar el núcleo en cada protocolo.

---

## ADR-002 — Pin `@solana/kit@^5.5.1` (no v6+) por peer dep de `@orca-so/whirlpools@^8`

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: El script de referencia apuntaba a "kit modernísimo" (v6+). La versión actual estable de `@orca-so/whirlpools` (8.0.0 en npm hoy) declara como peer `@solana/kit@^5`. Instalar `kit@^6` da `ERESOLVE`.

**Decisión**: Fijar `@solana/kit@^5.5.1`. La API que usamos (`createSolanaRpc`, `address`, `createKeyPairSignerFromBytes`, `getBase58Codec`) está disponible y estable entre v5 y v6.

**Consecuencias**:
- (+) Compatibilidad inmediata con Orca v8.
- (−) Al subir a `@orca-so/whirlpools@9` (si exige kit v6) habrá que mover ambos a la vez.
- (−) Otros adapters (Meteora) que prefieran kit v6 tendrán que aceptar v5 o convivir con shims.

---

## ADR-003 — Adapter Orca v8: RPC y funder globales del SDK; payer pasado explícito al callback

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: Orca v8 elimina `setWhirlpoolsConfig(network)` y reduce la firma a `closePosition(mint, config)`. La conexión RPC se setea globalmente con `setRpc(url)`. El SDK distingue dos roles:
- **Funder**: crea cuentas auxiliares (rent payer). Se fija con `setDefaultFunder(signer)`.
- **Payer**: firma la transacción final. Se obtiene con `setPayerFromBytes` (global) o se pasa al `callback(payer?)` de cada `ActionResult`.

En el primer intento solo configuré funder y el cierre falló con `Payer not set. Call setPayer() first.`

**Decisión**: En `init()` llamar `setRpc(url)` y `setDefaultFunder(wallet)`. Para el payer, NO usar `setPayerFromBytes` (requiere bytes en lugar de signer, peor reutilizabilidad). En su lugar, guardar `this.wallet` y llamar `result.callback(this.wallet)` en `closePosition` y `swapToExit`. Sin estado global de payer.

**Consecuencias**:
- (+) El payer queda asociado al adapter, no al proceso entero. Más limpio si en el futuro tenemos varios adapters concurrentes.
- (−) Cada instancia del adapter Orca pisa el RPC y funder globales del SDK. Múltiples instancias concurrentes del adapter Orca compartirían esos globals (no es escenario actual; riesgo asumido).

---

## ADR-004 — Retry con backoff vive en el núcleo, no en los adapters

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: Solana se congestiona y las tx fallan con frecuencia transitoria. Reintentar con backoff (y refresco implícito del blockhash) es necesario.

**Decisión**: `withRetry()` en `src/core/retry.ts` envuelve cada llamada al adapter desde el runner. Política: 5 intentos, backoff exponencial con base 1000ms (1s, 2s, 4s, 8s, 16s). Cada reintento re-llama el método del adapter completo, lo que implícitamente reconstruye la tx con blockhash fresco.

**Consecuencias**:
- (+) Un adapter nuevo no implementa reintentos.
- (+) Política uniforme para todos los protocolos.
- (−) Si el método del adapter tiene side effects no idempotentes y falla a mitad, el retry puede tener comportamiento raro (ej.: close exitoso + crash en confirmación → retry intenta cerrar de nuevo y falla con "Account not found"). Aceptable hoy; vigilar en logs.

---

## ADR-005 — Loop con `setTimeout` recursivo y `await`, no `setInterval`

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: `setInterval(fn, ms)` puede solapar iteraciones si `fn` tarda más que `ms`. En el bot, eso podría disparar el cierre dos veces o duplicar lecturas en condiciones de RPC lento.

**Decisión**: `src/core/loop.ts` usa `while (true) { await tick(); if stop break; await sleep(pollMs); }`. Iteraciones estrictamente secuenciales.

**Consecuencias**:
- (+) Cero solapamiento posible.
- (−) Si `tick()` tarda mucho, el polling efectivo se ralentiza (en vez de acumular cola, que sería peor). Trade-off correcto.

---

## ADR-006 — Safety net mainnet: requiere `ALLOW_MAINNET_LIVE=true`

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: El usuario quiere que el bot NUNCA opere en mainnet en vivo sin un acto consciente. `DRY_RUN=true` por defecto ya es una capa.

**Decisión**: En `loadBaseConfig()`, si `NETWORK=mainnet` y `DRY_RUN=false`, se requiere además `ALLOW_MAINNET_LIVE=true`. Si falta, el bot aborta con mensaje explícito al arrancar.

**Consecuencias**:
- (+) Doble confirmación antes de operar con fondos reales.
- (−) Un usuario nuevo que copie config sin leer puede confundirse al ver el error, pero el mensaje es explícito.

---

## ADR-007 — Auto-swap tras cierre como tx separada (no atómica)

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: Tras cerrar una posición que mantiene mayoritariamente un token (típico de out-of-range), el usuario puede querer acabar en el otro token (p. ej. take-profit en SOL → cobrar en USDC). Dos caminos: una tx atómica (close+swap juntos) o dos tx secuenciales.

**Decisión**: V1 hace dos tx independientes: primero `closePosition`, después `swapToExit`. El runner usa dos `withRetry` separados; si el swap falla el cierre ya está hecho y el retry solo afecta al swap.

**Consecuencias**:
- (+) Implementación significativamente más simple, sin tocar `tx-sender` ni combinar instruction arrays.
- (+) Si el swap falla, el cierre sigue siendo bueno: el usuario conserva el output del cierre y se reintenta solo el swap.
- (−) Entre las dos tx el precio puede moverse; el slippage del swap absorbe variaciones moderadas, pero no garantiza el resultado.
- Atomic close+swap queda en backlog para una iteración futura.

---

## ADR-008 — `EXIT_TOKEN_MINT` debe ser uno de los dos tokens del pool en v1

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: El usuario podría querer swapear a CUALQUIER token, no solo a uno de los del pool. Eso obligaría a usar un agregador (Jupiter) o multi-hop, y en devnet ambos son inestables (Titan no daba ruta en devnet en las pruebas).

**Decisión**: En `OrcaAdapter.swapToExit`, validar que `EXIT_TOKEN_MINT` coincide con `tokenMintA` o `tokenMintB` del pool de la posición. Si no, lanzar error explícito al iniciar el swap. El swap usa la misma pool de Orca (no agregador).

**Consecuencias**:
- (+) Liquidez garantizada (el pool existe porque la posición está en él).
- (+) Sin dependencias externas a agregadores.
- (−) Limita el caso de uso: si quieres terminar en un token distinto a los del pool, hoy no es posible.
- Soporte multi-hop / Jupiter queda en backlog.
