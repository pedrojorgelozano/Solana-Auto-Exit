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

---

## ADR-009 — Modelo no-custodial: herramienta personal self-hosted + open source

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: El usuario quiere convertir esto en algo que use él y sus amigos (10s, no 1000s), evitando líos regulatorios y manteniendo la confianza del entorno cripto. La discusión cubrió cuatro modelos posibles: navegador-only (descartado por necesitar 24/7), custodial cloud (descartado por compliance MiCA/FinCEN), programa on-chain propio tipo Arrakis (descartado por meses de trabajo + auditorías), y self-hosted distribuible.

**Decisión**: Modelo **Camino 1** (self-hosted): cada usuario corre su propia instancia (CLI / server local / Docker), su wallet vive en su máquina cifrada. Repo público en GitHub, licencia MIT cuando demos el salto a público en F4. Bind por defecto a `127.0.0.1`; opciones de 24/7 documentadas para quien quiera VPS (Tailscale o Cloudflare Tunnel, no abrir puertos).

**Consecuencias**:
- (+) Cero custodia → cero riesgo regulatorio.
- (+) Open source = auditabilidad por terceros.
- (+) Cada usuario controla su clave; pérdida de un usuario no afecta a los demás.
- (−) Escala limitada por el cuello de botella "ordenador encendido". Funciona para 10-100 usuarios técnicos, no para 100k retail.
- (−) Cero ingresos directos (donaciones o licencia dual en el futuro si interesa).
- (−) Soporte y onboarding más friccional (cada user instala algo).

**Alternativas consideradas**: las otras tres del análisis. Si más adelante el producto despega y se quiere monetizar, se reabre la conversación con datos.

---

## ADR-010 — pnpm + workspaces como gestor del monorepo

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: La introducción de `packages/server/` y `packages/web/` (planificada) hace impracticable seguir con un único `package.json` plano. Necesitamos workspaces.

**Decisión**: pnpm (no npm workspaces, no yarn) con `pnpm-workspace.yaml`. Cinco paquetes: `engine`, `cli`, `server`, `web`, root. Cross-package deps via `workspace:*`. Cada paquete declara explícitamente sus deps directas para legibilidad.

**Consecuencias**:
- (+) Resolución estricta y disco compacto vía hard-links de pnpm.
- (+) pnpm permite filtrar comandos por paquete (`pnpm --filter ...`).
- (−) Requiere instalar pnpm (`npm i -g pnpm`); pequeña fricción para nuevos colaboradores.
- (−) `pnpm-workspace.yaml` mantiene `allowBuilds` y `minimumReleaseAgeExclude` que hay que actualizar al añadir deps que compilan nativo (better-sqlite3, esbuild, sharp).

---

## ADR-011 — Stack del server: Hono + tRPC + Drizzle + SQLite

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: La UI necesita un backend persistente que: (a) exponga una API type-safe consumible desde React, (b) ejecute watchers de larga duración con persistencia, (c) sea ligero (corre en máquina personal o VPS pequeño), (d) tenga build/deploy simple.

**Decisión**:
- **HTTP**: Hono con `@hono/node-server`. Más ligero que Fastify, sintaxis moderna, buen soporte de WebSockets para F5.
- **API**: tRPC v11 con `@hono/trpc-server`. Type-safety end-to-end con el frontend sin escribir schemas dos veces; el `AppRouter` se exporta como tipo y el cliente lo consume.
- **Validación**: zod en cada procedure input.
- **Persistencia**: Drizzle ORM + better-sqlite3. Schema declarativo en TS con `$inferSelect`/`$inferInsert` para tipos. Migraciones generadas con `drizzle-kit`.
- **Lifecycle**: `process.on("SIGINT"|"SIGTERM")` cierra TaskManager + DB limpio.

**Consecuencias**:
- (+) Stack moderno y bien tipado top-to-bottom.
- (+) SQLite cero-infra, perfecto para single-user local.
- (−) better-sqlite3 requiere compilación nativa (build tools en Docker; ~2min primera vez).
- (−) tRPC es ecosistema propio (no REST estándar); si en el futuro queremos clientes no-TS, hay que añadir adapter REST.

**Alternativas consideradas**: Fastify + REST + Prisma (más estándar pero más boilerplate). Express + REST (descartado por edad). Cero backend usando file-system + IPC (descartado por inflexible).

---

## ADR-012 — Cifrado de la wallet con scrypt + AES-256-GCM nativo (sin deps externas)

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: El plan inicial planteaba Argon2id + AES-GCM via `@noble/ciphers` + `@noble/hashes`. Al implementarlo me di cuenta de que `node:crypto` tiene scrypt y AES-256-GCM nativos, con cero dependencias.

**Decisión**: KDF con `scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64*1024*1024 })`. Cifrado con `createCipheriv("aes-256-gcm", key, iv)`. El authTag de GCM detecta passphrase incorrecta con mensaje claro (no devuelve basura). Escritura atómica (.tmp + rename) con permisos 0600. Address pública guardada en claro como sanity-check al hacer unlock.

**Consecuencias**:
- (+) Cero dependencias externas para el cifrado de la wallet (menos superficie de auditoría para los amigos que abran el repo).
- (+) Misma familia de KDF que Solana CLI y Phantom — comportamiento conocido en el ecosistema.
- (−) scrypt es ligeramente menos resistente a GPU/ASIC que Argon2id en igualdad de parámetros, pero la diferencia es despreciable para "user password contra wallet local"; no es Bitcoin brain-wallet contra adversario con farm.

---

## ADR-013 — TaskManager: tasks activas pausadas al reiniciar, una instancia de adapter por task

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: Decisiones operativas sobre cómo se comporta el orquestador multi-posición. Tres preguntas concretas se cerraron con el usuario antes de implementar.

**Decisión**:
1. **Cuándo se descifra la wallet**: queda en memoria mientras el vault esté unlocked. No auto-lock en F0 (lo añadimos cuando duela); manual lock disponible via API.
2. **Boot**: tasks en estados `idle | armed | triggered | closing` se mueven a `paused` con `lastError="Server restarted; resume after unlocking the vault."`. El usuario las reanuda explícitamente desde la UI tras unlock.
3. **Vault lock → pausa global**: `pauseAllOnVaultLock()` aborta todos los watchers en ejecución y los marca paused con `lastError="Vault was locked while running."`.
4. **Una instancia de adapter por task**: simplifica la lógica (cada watcher tiene su propia config cacheada). Limitación conocida: el SDK Orca v8 tiene RPC global, así que tasks con distinto `rpcUrl` simultáneas pisan estado entre sí. En la práctica un usuario tiene un único RPC; aceptado el riesgo.

**Consecuencias**:
- (+) Recuperación segura tras reinicio: nada se mueve sin que el usuario lo apruebe.
- (+) Modelo mental claro de cuándo se firma: solo cuando vault unlocked + task con status activo.
- (−) Cualquier reinicio del server (incluido un OOM) requiere intervención manual para reanudar tasks. Aceptable mientras la base de usuarios sea técnica.

---

## ADR-014 — Stack del frontend: Next.js 15 + Tailwind 4 + React 19

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: Necesitamos UI moderna, responsive, mantenible. La UI será envuelta en Tauri más adelante (ADR-015), así que la app debe ser un SPA puro sin dependencias de SSR runtime.

**Decisión**:
- **Framework**: Next.js 15 con App Router. Pinned a 15.5 (estable). Build estático suficiente para servir desde Tauri.
- **UI**: React 19 (server + client components nativos del App Router).
- **Styling**: Tailwind 4 con config CSS-first (`@import "tailwindcss"` + `@theme` en `globals.css`, sin `tailwind.config.ts`). Tema oscuro custom vía CSS vars en `:root`.
- **Components**: shadcn/ui (copy-paste primitives a `src/components/ui/` cuando hagan falta — F1.3 en adelante).
- **State remoto**: TanStack Query (pendiente F1.2) vía `@trpc/react-query`.
- **Auth**: ninguna en local. Si en F5 exponemos sobre LAN, token de pareja en headers.

**Consecuencias**:
- (+) Stack 2025-mainstream, comunidad enorme, contratable.
- (+) Tailwind 4 sin config file reduce ceremonia.
- (−) Tailwind 4 es reciente; algunos plugins de v3 todavía no migrados. Hasta ahora no necesitamos ninguno.
- (−) App Router es complejo si se mezcla SSR con uso de tRPC en el cliente; lo mantenemos puramente client-side (`"use client"`) en F1.

---

## ADR-015 — Tauri en F4-F5, no desde F1

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: El producto final debe ser una app desktop instalable (.dmg / .msi / .AppImage) con auto-update, no una pestaña web. La pregunta es cuándo introducir Tauri en el plan: día 1 o más tarde.

**Decisión**: Empezar F1-F3 como app web pura servida por Next.js dev. Introducir Tauri en F4 envolviendo el bundle web + el server Node como sidecar. Builds nativos firmados y auto-update se montan en F4-F5 antes del release público.

**Consecuencias**:
- (+) Iteración rápida en pantallas durante F1-F3 sin la complejidad nativa.
- (+) El bundle final puede reusar 100% del trabajo web (Tauri carga el dist).
- (−) Hay que rehacer el flujo de empaquetado (Docker → Tauri instalador) en F4. Aceptable porque los modos pueden coexistir (Docker para quien quiera VPS, Tauri para desktop).

---

## ADR-016 — Backend siempre bindea a `127.0.0.1` por defecto

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: El server expone la wallet desbloqueada (en memoria) tras `wallet.unlock`. Cualquier proceso que pueda hablar HTTP con el server puede pedirle que firme. Si el server escucha en `0.0.0.0`, cualquier dispositivo de la LAN tiene esa capacidad.

**Decisión**:
- CLI y server local: `SERVER_HOST` default `127.0.0.1`.
- Docker: contenedor escucha en `0.0.0.0` internamente, pero el host hace bind `127.0.0.1:7777:7777` (Docker no acepta conexiones desde otras interfaces del host).
- Next.js dev: idem (`next dev -H 127.0.0.1`).
- Acceso remoto (24/7 vía VPS) se documentará en F3 vía Tailscale o Cloudflare Tunnel — nunca abriendo puertos directamente a internet.

**Consecuencias**:
- (+) Cero superficie de ataque por defecto.
- (−) Para acceso desde el móvil del propio usuario hace falta opt-in explícito (LAN access con token de pareja, F5).
