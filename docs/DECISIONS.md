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
**Estado**: Superada por [ADR-026](#adr-026--mainnet-gate-abierto-por-defecto-la-confirmaci%C3%B3n-de-ui-es-la-safety-net)

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

---

## ADR-017 — Dirección estética "trading desk editorial" para la UI

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: La primera iteración del frontend (F1.1–F1.6) usó la paleta default que cualquier modelo genera para una "dashboard cripto": near-black `#0a0a0b` + acento morado `#7c5cff` + fonts del sistema + cards anidadas. Feedback explícito del usuario: "muy fea, poco intuitiva, cosas que no entiendo ni yo". Es exactamente el patrón que el skill `frontend-design` describe como "AI slop" — la convergencia visual que se repite en Vercel/Linear/Railway y cualquier producto crypto de los últimos tres años.

**Decisión**: Comprometerse con una dirección estética concreta y opuesta a esa convergencia: **trading desk editorial**.

- **Paleta**: ink negro cálido (`#0c0a08`, no `#000`) + crema (`#f0e7d4`) + **un único acento** oxblood/burdeos (`#8b1e1e`, hover `#b13838`). Estados con cobre (`#b88746`) y tinta-azul (`#6890a8`) en lugar de verde/rojo bandera.
- **Tipografía**: Fraunces variable serif (display + headings con axes ops + SOFT + WONK para carácter editorial) + Instrument Sans (body) + JetBrains Mono (números con tabular nums + slashed zero). Cero Inter, Arial, ni sans genéricos.
- **Composición**: hairlines en lugar de cards apiladas. Asimetría (grid 12-col con splits 7/5). Densidad alta en data (tablas tipo statement bancario). Espacio generoso en decisiones (forms con generous padding).
- **Atmósfera**: grain overlay vía SVG turbulence (6% opacity, mix-blend overlay) sobre todo el body. No flat dark.
- **Motion**: discreto. Un `fade-in` al cargar página, un `pulse-soft` para estados activos. Sin parallax, sin spring, sin "hover lift".

**Consecuencias**:
- (+) Identidad propia, no confundible con DefiTuna / Vercel / Linear / etc.
- (+) Los números son protagonistas (tabular-nums, tamaños grandes en hero, mono donde toca).
- (+) Sistema de tokens declarado (CSS vars `--color-*`, utilidades `.t-*`) facilita variantes futuras.
- (−) Curva de aprendizaje breve para colaboradores que esperen Tailwind defaults / shadcn-ui.
- (−) Fraunces variable es ~80kb gzipped — aceptable, pero pesa más que una sans system.

**Alternativas consideradas**: minimal brutalist (Helvetica + cero color, descartado por sentirse de oficina sin vida), playful 2020s (gradientes / glassmorphism, descartado por ruidoso para un producto de datos), mantener el estilo previo con mejoras de copy (descartado — el feedback era visual).

---

## ADR-018 — Take-profit + Stop-loss simultáneos en un único auto-exit

**Fecha**: 2026-05-20
**Estado**: Aceptada · supera el modelo single-direction de [ADR-007](#)

**Contexto**: El modelo inicial del auto-exit tenía una sola dirección (`above` | `below`) y un `targetPrice`. El usuario señaló que herramientas como Krystal permiten configurar TP **y** SL en el mismo auto-exit y dispararse el que toque primero. Es un patrón de UX standard (todo broker de trading lo hace) y nuestro modelo single-direction era una limitación arbitraria.

**Decisión**: Un auto-exit puede tener `takeProfitPrice`, `stopLossPrice` o ambos (con al menos uno definido). El watcher evalúa los dos en cada tick. Si los dos cumplen en el mismo tick (precio cruzó todo el rango entre ticks), prioriza take-profit. Se registra `triggeredBy: "take_profit" | "stop_loss"` en el row para auditar el motivo.

- DB schema: eliminadas `target_price` y `direction`; añadidas `take_profit_price` (real nullable), `stop_loss_price` (real nullable), `triggered_by` (text enum nullable).
- Validación zod en `tasks.create`: dos `.refine`. (1) al menos uno definido > 0. (2) si los dos definidos, TP > SL.
- UI: dos `TriggerInput` independientes en el form con su propio toggle, presets ±% y price input. Display unificado vía `formatTriggers(tp, sl)` y `formatNearestDistance(current, tp, sl)`.

**Consecuencias**:
- (+) Cubre el caso normal de trading (poner take-profit y stop-loss a la vez antes de irte).
- (+) UX clara: el usuario decide qué triggers quiere, no qué "direction".
- (−) Migración DB destructiva (regenerada la 0000 desde cero, dev wipe asumido). En F2+ si hay deploys reales con data, requiere migración con backfill: `take_profit_price = target_price WHERE direction = 'above'; stop_loss_price = target_price WHERE direction = 'below'`.
- (−) El path CLI (`packages/cli`) sigue usando el modelo single-direction vía `BaseConfig.targetPrice` + `BaseConfig.direction` (legacy). El server bypassa BaseConfig y usa el row directamente. Documentado en `TaskManager.toBaseConfig`.

---

## ADR-019 — Regla "un auto-exit activo por posición"

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: Un usuario podría crear varios auto-exits sobre la misma posición Whirlpool. Eso no tiene sentido funcional — solo se puede cerrar la posición una vez, así que el segundo watcher quedaría huérfano cuando el primero cerrase. La UI inicial permitía esta inconsistencia.

**Decisión**: La UI **enforza** que solo haya un auto-exit activo por `positionId` (activo = estado ∈ `idle | armed | triggered | closing | paused`). Estados terminales (`done | error | stopped`) no cuentan, así que el usuario puede crear uno nuevo tras un cierre o stop manual.

- `/positions/[mint]` detecta el auto-exit activo (si existe) y renderiza `ExistingWatcher` con datos live + CTAs "Open auto-exit" / "Delete auto-exit", en lugar del form.
- `/positions` lista marca con un chip pulsante `auto-exit set` las posiciones que ya tienen uno.
- El backend **no** valida esto todavía (la UI es la única gate). Listado en backlog: añadir `refine` o check explícito en `tasks.create` para que el espejo sea coherente.

**Consecuencias**:
- (+) Modelo mental claro: una posición → un compromiso de salida.
- (+) Evita confusiones tipo "¿por qué cerró si dije que el target era 30?" cuando había un segundo watcher con target distinto.
- (−) Por ahora la regla solo está en UI; un cliente tRPC pirata podría crear dos. Aceptable mientras la UI es el único cliente público.

---

## ADR-020 — Connect-wallet modal Orca-style es cosmético: la firma sin presencia sigue requiriendo clave en el server

**Fecha**: 2026-05-20
**Estado**: Aceptada

**Contexto**: El usuario pidió "Connect Wallet" como Orca/Meteora. Eso normalmente significa wallet adapter + Phantom popup que firma cada tx. Para un dApp donde el usuario está presente en cada acción, funciona. Para nuestro caso (auto-exit que dispara mientras el usuario duerme) no.

**Decisión**: Implementar un modal estilo Orca con tres rutas (Generate / Import base58 / Import JSON) que por debajo sigue cifrando una clave que el server guarda. **No** implementar wallet adapter real con popup de firma por tx — rompería el use-case del bot. Reafirma [ADR-009](#) (modelo self-hosted no-custodial-via-program, con clave cifrada en el server).

- `wallet.generate(passphrase)`: server crea ed25519 vía `node:crypto`, lo cifra, devuelve la base58 del secret **una sola vez** para que el user lo guarde en su password manager.
- Modal con tabs Generate (badge "recommended") / Import base58 / Import JSON.
- VaultChip cuando no hay wallet abre el modal en vez de linkear a `/wallet`.
- Documentación: el README + onboarding del modal explican honestamente que el server necesita la clave para firmar sin presencia. No vendemos lo que no somos.

**Consecuencias**:
- (+) UX dApp-moderno sin sacrificar el modelo de bot.
- (+) Generate-in-server es el camino más amable (cero copy-paste de la clave; el usuario solo guarda lo que el server le da una vez).
- (−) Sigue requiriendo confianza en el server local. Si el usuario espera "Phantom popup" tipo dApp, hay que explicárselo (lo cual hacemos en el copy del modal).
- (−) El secret viaja del server al cliente vía HTTPS local en la respuesta de la mutation. Localhost-only por default; si en F5 exponemos sobre LAN con token, esto sigue siendo seguro porque la ruta requiere auth, pero documentar en SECURITY.md.

**Alternativa considerada**: wallet adapter real + tx pre-firmadas con durable nonces. Brittle (nonce caduca, parámetros del cierre tienen que conocerse de antemano, sin re-sign si la tx falla). Descartado.

---

## ADR-021 — Onboarding pedagógico: contenido editorial in-app, no tour overlay

**Fecha**: 2026-05-21
**Estado**: Aceptada · refina [ADR-020](#) corrigiendo el framing del modelo wallet

**Contexto**: Tras navegar el primer flujo de onboarding (modal "Connect bot wallet" estilo Orca, [ADR-020](#)), surgieron dos problemas. (1) La palabra "Connect" colisiona semánticamente con el patrón Phantom/Backpack — promete una experiencia que el producto no puede dar. (2) El copy del Import tab invitaba activamente a pegar la clave de la wallet principal del usuario ("This is what Phantom and Backpack show when you export a private key"), y mi propia explicación del *blast radius* en la conversación era imprecisa: dije "todo lo que tenga tu Backpack" cuando lo correcto es "todos los assets de la address concreta cuya clave importes" — porque la app acepta solo claves privadas individuales, no seed phrases.

Paralelamente, el primer minuto de la herramienta no enseñaba el modelo: el hero era una pieza estética sin pedagogía, no había documentación, los empty states eran mudos. El usuario llegaba sin entender por qué hace falta una "bot wallet", cómo conseguir posiciones en ella, ni qué hace el modo simulación.

**Decisión**: Comprometerse con un onboarding **pedagógico como contenido editorial**, no como tour overlay (Driver.js / Intercom / Shepherd). Cinco piezas implementadas en una sola sesión:

1. **Home first-run hero** dedicado cuando no hay wallet: eyebrow + display + tres steps editoriales ("Bot wallet", "Funded positions", "Triggers") + CTAs.
2. **Modal redesign** con tres caminos honestos (Generate / Import key / Advanced · JSON) presentados al mismo nivel, sin badge "recommended". Preamble explícito de que no es Phantom-style. Warning técnico con el framing corregido del blast radius — la app no acepta seed phrases por construcción, así que importar una clave nunca puede comprometer más de una address.
3. **Empty states ricos** en `/positions` (con la address de la bot wallet copiable + los dos sub-caminos para meter LPs) y `/tasks`.
4. **`/docs` in-app** con 6 artículos editoriales: Getting started, The bot wallet, Auto-exit triggers, Operations, Security model, FAQ. Sidebar de navegación. Hardcoded TSX inicialmente (decisión de velocidad, no de arquitectura).
5. **Links contextuales** sembrados en los puntos donde aparecen conceptos no obvios (modal preamble, simulation toggle, /wallet description, etc).

**Consecuencias**:
- (+) Onboarding alineado con la dirección estética (editorial, [ADR-017](#)). Sin overlays que rompan la composición.
- (+) Sin dependencia nueva (cero coste de runtime, ningún `driver.js` que mantener).
- (+) El blast radius queda explicado **honestamente y con precisión** — el usuario decide qué cuenta importar con criterio, no con miedo difuso.
- (+) Documentación in-app sirve también como referencia post-onboarding (vuelves a `/docs` cuando reinicias el server, no solo la primera vez).
- (+) Empty states pedagógicos siguen una "cadena": `/positions` vacío manda a abrir LPs; `/tasks` vacío manda a `/positions`. Aprendes haciendo.
- (−) Más texto que mantener cuando algo cambia. Mitigación: TODO captura migrar a markdown single-source cuando los artículos crezcan o cuando enlazamos GitHub README en F4.
- (−) Sin tour overlay, un usuario muy nuevo podría no descubrir `/docs`. Mitigación: link "Docs" en el GlobalHeader + ghost CTA "Read the full guide" junto al CTA primario del first-run hero.
- (−) El contenido vive en `app/docs/{slug}/page.tsx` como JSX — no se previsualiza en GitHub. Aceptable mientras el repo sea privado (pre F4).

**Alternativas consideradas**:
- **Tour overlay (Driver.js / Intercom-style)** — descartado por incompatible con la dirección estética y por infantilizar a una audiencia técnica.
- **Documentación solo en GitHub README** — descartado por requerir abandonar la app y por no servir cuando F4 entregue Tauri offline.
- **MDX desde el principio** — descartado por overengineering para 6 artículos cortos; queda en backlog para cuando el contenido crezca.
- **`/welcome` post-creación** — descartado; el success screen del modal ya cubre el "qué hago ahora" con sus tres pasos, y los empty states refuerzan la cadena.

---

## ADR-022 — On-chain verification post-tx: best-effort + event-only persistence

**Fecha**: 2026-05-21
**Estado**: Aceptada

**Contexto**: Tras un cierre o swap reales, el `closeResult`/`swapResult` que devuelve el adapter contiene solo el *quote* del SDK de Orca (estimaciones pre-firma). El usuario quiere ver qué entró realmente en la bot wallet — saber si el quote fue fiel, si el slippage mordió, o si algún detalle inesperado se llevó parte de los fondos. Tres preguntas de diseño abiertas: (1) ¿cuándo y cómo verificar? (2) ¿persistir en una columna nueva del task row o en un evento de `history`? (3) ¿qué hacer si la verificación falla o el RPC no devuelve la tx?

**Decisión**: Verificación on-chain como paso *best-effort* dentro de `TaskManager.executeClose`, ejecutado solo cuando `dryRun === false` y hay `txId`:

1. **Fuente de verdad**: el receipt de la tx (`getTransaction` vía JSON-RPC directo, sin Kit) — preBalances/postBalances para SOL nativo, preTokenBalances/postTokenBalances filtrados por `owner === botWallet` para SPL. No usamos snapshots pre/post separados.
2. **Helper**: `packages/server/src/tasks/verify.ts` con `verifyTxBalances(rpcUrl, signature, owner)`. Retry lineal 5x con backoff `500ms × (i+1)` porque a veces el indexer del RPC tarda 1-2s tras la confirmación. Devuelve `{ fee: bigint, solDelta: bigint, tokenDeltas: Record<mint, bigint> }`.
3. **Persistencia**: nuevo evento `verified` en la tabla `history` con payload `{ kind, signature, fee, solDelta, tokenDeltas, quoted }`. **Sin columna nueva** en `tasks`. La UI (`/tasks/[id]`) busca el evento por kind+signature y renderiza un `ActualLine` debajo de cada cell del receipt.
4. **Fallo silencioso**: si el RPC tarda más de los 5 retries o devuelve error, se loguea y se sigue. El task ya está en `done`/`error` por otra vía; perder la verificación no rompe el watcher.
5. **Diff %**: computado en el cliente, no en el backend. Hoy hardcoded a warning si `|diff| ≥ 0.01%` (ver TODO backlog para hacerlo configurable). Para SOL no mostramos diff % porque el `solDelta` incluye tx fee + rent recovery, sería ruido.

**Consecuencias**:
- (+) Cero migración de schema. Solo `TaskEvent` añade `"verified"` y el código del manager.
- (+) Auditable retroactivamente — el evento queda en `history`, persistente y enlazable a la tx.
- (+) Verification falla silenciosamente sin afectar el flujo crítico (close + swap).
- (+) JSON-RPC directo evita pagar el ciclo de `@solana/kit` para una llamada que no necesita tipos elaborados.
- (−) No se puede hacer una query SQL "tasks con diff > 1%" sin parsear JSON de la history — si en el futuro queremos métricas agregadas, habría que materializar columnas o hacer un view.
- (−) Diff threshold hardcoded en el frontend. Cualquier ajuste exige redeploy del bundle.
- (−) Si el indexer del RPC NUNCA termina de tener la tx (raro pero posible en mainnet con RPCs públicos), nunca emitimos `verified`. El receipt seguirá mostrando solo quoted.

**Alternativas consideradas**:
- **Columna `verifyResult` JSON en `tasks`**: descartada por requerir migración y por mezclar quote (que es del SDK) con post-tx truth (que es del RPC) — dos fuentes distintas en el mismo row.
- **Snapshot manual pre/post**: descartado porque doblamos las RPC calls y abrimos race conditions (¿qué pasa si entre el snapshot y la tx alguien más transfiere a esa address?). El receipt de la tx ya nos da pre y post atómicamente.
- **Verificación bloqueante con error si falla**: descartada porque convertiría un fallo del RPC en un task `error`, cuando la realidad es que el cierre ya está hecho on-chain — la verificación es solo un audit. La transparencia ("el RPC no me devolvió la tx") no debería corromper el estado funcional.

---

## ADR-023 — Settings como key-value table; mainnet bloqueado en UI hasta F4

**Fecha**: 2026-05-21
**Estado**: Aceptada · refina la separación entre configuración global y per-task de [ADR-013](#)

**Contexto**: F3 introduce un `/settings` page que persiste valores por defecto (RPC URL, slippage, intervalo de poll) entre sesiones. Dos opciones de modelado: (a) tabla con columnas tipadas (`settings_rpc_url`, `settings_slippage`, etc.) o (b) tabla genérica key/value. Además, una decisión sensible: el schema permite `network: "mainnet"` en cada task, pero exponer "mainnet" como opción en la UI antes de tener Tauri + codesign + audit visual es invitar a un usuario a perder dinero real por confusión.

**Decisión**:

1. **Tabla `settings` con shape (`key` PK, `value` text)** — clave/valor genérica. Decisión ya estaba en el schema desde F0 pero sin usar; en F3.1 se activa.
2. **Snapshot tipado en el servidor**: el router define un `SettingsSnapshot` interface con keys conocidas (`network`, `rpcUrl`, `defaultSlippageBps`, etc.). `get` aplica defaults hardcoded a las keys ausentes. `update` usa zod discriminated union para validar cada key. La UI consume el snapshot, no las filas raw.
3. **Mainnet bloqueado en UI**: el zod schema de `update` solo acepta `value: z.literal("devnet")` para la key `network`. Es decir, no se puede setear `mainnet` desde la UI ni de pasada. El gate de ADR-006 (`ALLOW_MAINNET_LIVE=true`) sigue siendo el último filtro a nivel CLI; en UI lo cerramos por construcción hasta F4.3 (mainnet UI gate explícito con confirmación en dos pasos).
4. **Defaults centralizados en el router** (`DEFAULTS` constant). Las constantes en `packages/web/src/lib/constants.ts` quedan como fallback cuando la query de settings aún no resolvió.
5. **Snapshot de tarea sigue siendo per-row**: cada `task.rpcUrl` y `task.network` se serializa con el valor vigente al crear el task. Cambiar el RPC en `/settings` no afecta a tasks ya armadas (la decisión de [ADR-013](#)). Las nuevas heredan el default actual.

**Consecuencias**:
- (+) Migración cero al añadir keys nuevas. Cada nueva key es un literal en el `KEYS` map + un caso en el discriminated union de zod.
- (+) Mainnet inaccesible desde la UI por construcción, no solo por convención. Un cliente tRPC pirata tampoco puede setearlo (zod lo rechaza).
- (+) El boundary "configuración global vs snapshot per-task" queda explícito — sin riesgo de mutar una task viva al editar settings.
- (+) Defaults visibles en un solo sitio (`DEFAULTS` en el router) para auditar/cambiar.
- (−) `value` en SQLite es siempre `text`. Para enteros (slippage, poll) hacemos `parseInt(value, 10) || fallback` en `get`. Aceptable mientras las keys sean pocas y conocidas.
- (−) Cualquier UI o cliente que quiera "switch to mainnet" tendrá que esperar a F4.3. Hoy es por diseño — abriremos cuando codesign + audit visual estén en su sitio.
- (−) Al haber dos fuentes de "qué settings hay" (el `KEYS` map del router + el form del frontend), un cambio en una requiere espejo en la otra. No es DRY, pero la separación servidor/cliente lo justifica.

**Alternativas consideradas**:
- **Tabla con columnas tipadas**: descartada por requerir migración cada vez que añadamos una key (RPC API key futura, exit-token default, etc.).
- **Variables de entorno**: descartadas porque queremos editar desde la UI sin reiniciar el server.
- **JSON blob en una sola row**: descartada porque las escrituras serían pesadas (write-all-or-nothing) y los conflicts de concurrencia más probables.
- **Permitir "mainnet" en UI con un warning verbose**: descartada por ser exactamente el patrón que ADR-006 quiere prevenir. La UI debe ser literalmente incapaz de pedirle al server `network: "mainnet"` hasta que F4.3 lo abra explícitamente.

---

## ADR-024 — Coexistencia de SDKs Solana en los adapters + workaround ESM/CJS de anchor

**Fecha**: 2026-05-21
**Estado**: Aceptada · refina (no supera) [ADR-001](#) y [ADR-002](#)

**Contexto**: F6.1 introdujo el adapter de Meteora DLMM, que depende de `@meteora-ag/dlmm@^1.9.10`. Esa librería pide `@solana/web3.js@^1` y `@coral-xyz/anchor@0.31.0` como deps, no `@solana/kit@^5`. Esto contradice el pin de [ADR-002](#), que fijó kit v5 porque Orca v8 lo demandaba — pero el pin en realidad solo afectaba al adapter de Orca, no a la arquitectura. Dos problemas concretos al integrar:

1. **Mismatch de SDK**: ¿Cohabita web3.js v1 con kit v5 en el mismo proyecto? La frontera del contrato `ProtocolAdapter` ya pasa primitivos (strings, bigints, plain objects). El contagio sería en `node_modules`, no en el código del núcleo.
2. **Bug ESM/CJS al cargar el SDK**: el bundle ESM (`dist/index.mjs`) de `@meteora-ag/dlmm` intenta `import { BN } from "@coral-xyz/anchor"` y anchor 0.31.x no re-exporta `BN` como named ESM export → `SyntaxError: The requested module '@coral-xyz/anchor' does not provide an export named 'BN'` al cargar bajo ESM puro. Falla incluso con typecheck verde, en el primer `tsx scripts/probe-meteora.ts`.

**Decisión**:

1. **Cada adapter usa el SDK que prefiera.** El contrato `ProtocolAdapter` está diseñado para esto (ADR-001) y F6.1 lo valida empíricamente. Concretamente:
   - `packages/engine/package.json` carga **ambos** SDKs como deps directas: `@solana/kit@^5` (lo usa Orca) y `@solana/web3.js@^1` (lo usa Meteora).
   - Cada adapter encapsula la conversión `string ↔ PublicKey | Address` dentro de sus métodos. El núcleo y el server solo ven strings.
   - Los tipos como `KeyPairSigner` (kit) que llegan a `attachWallet` se convierten internamente — F6.2 lo hará vía `getBase58Codec().decode(...)` + `Keypair.fromSecretKey()` para Meteora.
2. **El bug ESM/CJS se resuelve con `createRequire` puntual en el adapter de Meteora.** No tocamos la config de tsx/Node ni el `module` de tsconfig:
   ```ts
   import { createRequire } from "node:module";
   import type * as DLMMNs from "@meteora-ag/dlmm";
   const requireCjs = createRequire(import.meta.url);
   const meteoraSdk = requireCjs("@meteora-ag/dlmm") as typeof DLMMNs & {
     default: typeof DLMMNs.default;
   };
   ```
   Los tipos vienen del `import type` que tsc resuelve a `dist/index.d.ts`; el runtime se carga vía `dist/index.js` (CJS bundle) gracias a `createRequire`. anchor no falla bajo CJS.
3. **Las deps nativas opcionales que arrastra Meteora se marcan `allowBuilds: false`** en `pnpm-workspace.yaml` (`bigint-buffer`, `bufferutil`, `utf-8-validate`). Todas tienen fallback puro-JS funcional; el log `bigint: Failed to load bindings, pure JS will be used` es esperado.

**Consecuencias**:
- (+) [ADR-001](#) (núcleo agnóstico, adapter por protocolo) queda validado con un segundo protocolo real, no solo en teoría.
- (+) Añadir Raydium / Jupiter LP / cualquier otro DEX no requiere migrar Orca ni Meteora. Cada uno aterriza con su propio SDK.
- (+) El workaround `createRequire` está aislado a una línea con comentario explicativo en `meteora/adapter.ts`. Si alguien lo "limpia" en el futuro, el ADR y el comment lo paran.
- (+) Las deps nativas opcionales no requieren build tools en Docker para Meteora — los fallbacks JS son suficientes para read-only.
- (−) `node_modules` crece ~30MB con web3.js v1 + anchor + transitivas (no es despreciable pero asumible para un self-hosted tool).
- (−) Dos tipos distintos de PublicKey en el codebase (`Address` de kit, `PublicKey` de web3.js v1). Cada adapter convierte en su frontera; no se propaga al núcleo.
- (−) Si tsx cambia su comportamiento con la "source" field de packages, podríamos necesitar revisitar — pero el `createRequire` es robusto frente a eso porque salta directamente al CJS.
- (−) El bundle ESM de Meteora podría arreglarse upstream (`import * as anchor from "@coral-xyz/anchor"`); si eso pasa, podemos simplificar a un `import` normal. Lo dejamos como deuda menor.

**Alternativas consideradas**:
- **Forzar a Meteora a kit v5** (shim): descartada — los `BN.js` y `anchor.Program` pintan profundo en el SDK; reescribir sería medio adapter más.
- **Sólo importar `dist/index.mjs` con subpath**: descartada porque el problema NO era el resolver (tsx ya respeta `exports`), sino el bug interno de anchor en ESM. La subpath import no resuelve nada nuevo.
- **Cambiar `module` de tsconfig a CommonJS para todo el monorepo**: descartada — rompería las imports ESM del resto. createRequire es quirúrgico.
- **Esperar a que Meteora publique una versión que funcione bajo ESM puro**: sin ETA. Anclar Meteora a un fix futuro es deuda diferida; mejor capturar el workaround ahora.

---

## ADR-025 — Time buffer por trigger: sustained-price con reset duro, in-memory

**Fecha**: 2026-05-21
**Estado**: Aceptada · extiende [ADR-018](#) (TP+SL simultáneos)

**Contexto**: Krystal (la referencia EVM que usa el usuario) ofrece un "time buffer" por trigger: el precio tiene que **mantenerse** en la zona del target durante una duración configurable antes de que el auto-exit dispare el cierre. La descripción literal de Krystal — *"adjust time buffers to determine the duration for which the price must hold to activate the trigger"* — confirma la semántica de continuidad (no se trata de filtrar wicks de 30s, sino de exigir movimiento sostenido durante horas/días). Sin esto, el bot dispara un cierre con cualquier cruce momentáneo (un pump de 5min que revierte, una lectura puntual del oráculo después de un sandwich attack), lo que es exactamente el modo de fallo más caro para una posición LP.

Cuatro decisiones había que cerrar antes de implementar.

**Decisión**:

1. **Buffer por trigger, no global**. Cada uno de `takeProfitPrice` y `stopLossPrice` tiene su propio `*BufferMs`. Lógicamente son condiciones independientes; un usuario puede querer cerrar en TP en cuanto cruce ("estoy seguro, lleva subiendo") pero protegerse en SL con un buffer de 1d ("no quiero salir por una mecha"). Dos columnas nuevas en la tabla `tasks`: `take_profit_buffer_ms` y `stop_loss_buffer_ms`. Null o 0 = sin buffer (comportamiento legacy: dispara en el primer tick que cruza).

2. **Reset duro**. Si el precio sale de la zona del trigger antes de que el cronómetro complete su tiempo, el timestamp `firstCrossedAt` se borra. Cuando el precio vuelva a cruzar, el cronómetro arranca desde cero. Esto se deriva semánticamente de "must **hold**" — si dejó de mantenerse, dejó de cumplir la precondición. Sin hysteresis ni reset suave.

3. **Cronómetro in-memory, reset on restart**. El timestamp del primer cruce vive en `RunningEntry` dentro del `TaskManager`, no en SQLite. Si el server reinicia con un cronómetro a mitad, al reanudar la task el cronómetro arranca de cero. Decisión conservadora: si el server estuvo caído N horas, no sabemos qué hizo el precio durante ese tiempo, y disparar un cierre basado en un "estaba a punto de cumplir" sería falso. Mejor exigir un cumplimiento entero, observado.

4. **Máximo 7 días**. Krystal pone 12h como tope. Subimos a 7d para casos como "cerrar solo si la subida se mantiene una semana entera". Más allá hay diminishing returns: si el precio se mantiene 7 días continuos, ya está clarísimo que el movimiento es real. El zod schema del router rechaza valores mayores; la UI ofrece presets discretos `off / 6h / 12h / 1d / 3d / 7d`.

**Máquina de estados** (en `TaskManager.evalBuffer`):

| Estado del precio | Cronómetro | Acción |
|---|---|---|
| Fuera de zona | `null` | No-op. Sigue polling. |
| Fuera de zona | activo | Reset a `null`. Emit `buffer_reset`. |
| En zona, sin buffer config | — | Ready inmediato (legacy). |
| En zona, buffer config | `null` | Arma a `Date.now()`. Emit `buffer_armed`. No ready. |
| En zona, buffer config | activo, < bufferMs | Sigue polling. No ready. |
| En zona, buffer config | activo, ≥ bufferMs | Ready. Dispara cierre. |

Eventos nuevos en `history`: `buffer_armed` (payload `{kind, bufferMs}`) y `buffer_reset` (payload `{kind}`). El timeline del UI los renderiza con tono accent (armed) y muted (reset).

**UI**:
- Form en `/positions/[mint]`: dentro de cada `TriggerInput`, debajo del input de precio, un `Segmented` "Time buffer" con los 6 presets. Default `off`. Acompañado de un copy explicativo que cambia según `bufferMs > 0` ("Close only if the price stays above the target for at least this long. If it leaves the zone, the timer resets.") vs off ("Fire as soon as the price crosses the target — no waiting.").
- `ExistingWatcher`: bajo cada cell de TP/SL aparece "buffer 12h" + si hay cronómetro activo, "4h 23m left" en accent. El cliente computa el tiempo restante con `Date.now() - firstCrossedAt`. Refresca cada 5s vía la query de tasks.
- `/tasks/[id]`: igual en el hero (`TriggerBlock`) + una fila nueva "Time buffer" en el panel de Configuration solo si alguno está configurado.

**Consecuencias**:
- (+) Cubre el caso UX standard de "no me cierres por un wick". Feature-parity con Krystal en su parámetro más distintivo.
- (+) Backward-compatible por construcción: tasks existentes tienen ambos buffer = null y se comportan exactamente igual que antes.
- (+) Cronómetros independientes por trigger → flexibilidad real (TP agresivo + SL conservador, o viceversa).
- (+) Reset on restart elimina la categoría "el bot disparó por algo que no vio porque estuvo caído". Trade-off favorable a la seguridad sobre la conveniencia.
- (+) Migración aditiva (`0001_fast_silverclaw.sql` es solo dos `ALTER TABLE ADD`), sin destrucción de data.
- (−) Si el server reinicia justo antes de cumplir un buffer largo (digamos 12h llevaba 11h 50m), el usuario pierde toda la espera. Mitigación documentada en `/docs/auto-exit` (queda pendiente actualizar el artículo).
- (−) Reset duro puede sorprender en mercados muy volátiles cerca del target ("¿por qué no ha disparado si lleva 4 días pegado?"). Los eventos `buffer_armed`/`buffer_reset` en el timeline lo explican post-hoc, pero la primera vez puede ser confuso.
- (−) Sin persistencia del cronómetro, no se puede correlacionar cuántos resets hubo en una task (sería visible solo en `history`, no agregado).

**Alternativas consideradas**:
- **Reset suave (hysteresis)**: el cronómetro tolera salidas breves o pequeñas. Descartado por contradecir la semántica "must hold" de Krystal y por añadir parámetros opacos (¿qué cuenta como "breve"?). Si se demuestra necesario, se puede añadir como segundo parámetro opcional sin romper el modelo actual.
- **Persistir el cronómetro en SQLite**: descartado por la complejidad operativa (qué hacer si el server estuvo caído 4h durante un buffer de 6h — ¿asumimos que se mantuvo? imposible saberlo sin haber polled). El reset on restart es la respuesta segura.
- **Buffer global único**: descartado por el feedback explícito del usuario — "el buffer es configurable por auto-exit (es un campo más del stop loss o take profit)".
- **N polls consecutivos en lugar de tiempo**: descartado por acoplar el comportamiento a `pollMs`. Un buffer de "4 polls" cambia de significado si el usuario sube pollMs de 30s a 5min. El timestamp absoluto es independiente del polling.

---

## ADR-026 — Mainnet gate abierto por defecto; la confirmación de UI es la safety net

**Fecha**: 2026-05-21
**Estado**: Aceptada · supera [ADR-006](#adr-006--safety-net-mainnet-requiere-allow_mainnet_livetrue)

**Contexto**: ADR-006 cerró el switch a mainnet con un doble candado: env var `ALLOW_MAINNET_LIVE=true` al arrancar el server **y** confirmación de doble paso en la UI. El primer candado nació del miedo razonable a que un usuario nuevo, copiando configs sin leer, pasase de devnet a mainnet por accidente. Tras varios meses de uso real y con el panel de `/settings` redondeado (toggle TEST/REAL + checkbox "I understand this will sign with real funds" + botón danger), el env var pasó de ser una protección a ser fricción opaca: cada vez que el usuario quería mover entre redes, tenía que recordar editar un `.env`, reiniciar el server, y volver a la UI. La explicación en la UI ("Real mode is locked. Set ALLOW_MAINNET_LIVE=true and restart…") era confusa incluso para el propio usuario que la escribió.

**Decisión**: El gate de mainnet en el server (`isMainnetGateAllowed()`) devuelve `true` siempre. El switch TEST ↔ REAL en `/settings` está disponible sin pre-configuración. La única safety net activa es la confirmación de doble paso en la UI:

1. Click en el chip <strong>REAL</strong> → no aplica el cambio aún, despliega un panel inline.
2. Checkbox <em>"I understand this will sign with real funds and I've updated my RPC URL."</em>.
3. Botón danger <em>Confirm · use real funds</em>. Solo este botón persiste el cambio.

El env var `ALLOW_MAINNET_LIVE` se mantiene en el código del engine (path CLI) con semántica **opt-OUT**: si lo pones explícitamente a `false`, el wrapper `loadBaseConfig()` aborta cualquier ejecución mainnet con `DRY_RUN=false`. Útil para CI / scripts no supervisados donde el operador humano no está presente. El path UI (server tRPC) ignora la variable por completo.

**Consecuencias**:
- (+) UX limpia: el usuario alterna entre TEST y REAL desde la UI sin tocar archivos ni reiniciar nada.
- (+) La explicación verbosa "Real mode is locked. Set ALLOW_MAINNET_LIVE=true and restart…" desaparece del settings page.
- (+) Backward-compatible para el path CLI: usuarios que tenían `ALLOW_MAINNET_LIVE=true` en su `.env` siguen funcionando sin cambios.
- (+) Si alguna vez se vuelve a necesitar cerrar el gate por defecto (despliegues compartidos, scripts automatizados, decisión empresarial), el campo `mainnetGateAllowed` del snapshot tRPC se mantiene en la API y el código del Segmented soporta `disabled`. Re-cerrar es un cambio de una línea.
- (−) Pierde una capa de fricción. Un usuario que clickee REAL por error en lugar de TEST necesita pasar por el checkbox + botón danger para confirmar — sigue siendo no-trivial, pero menos paranoico que el doble candado original.
- (−) La doc de `/docs/security#mainnet-gate` queda como "histórico del modelo anterior" para los que vienen de versiones previas.

**Alternativas consideradas**:
- **Mantener ADR-006 tal cual**: descartado tras feedback explícito del usuario sobre la fricción opaca.
- **Default opt-IN suave** (env var sigue cerrando el gate por defecto, pero la UI muestra el toggle siempre con tooltip "lo puedes abrir, mira la doc"): descartado por ser un compromiso sin ganancia clara — sigue requiriendo editar `.env` para usar mainnet.
- **Eliminar `ALLOW_MAINNET_LIVE` del todo**: descartado para no romper el path CLI de scripts existentes. La inversión a opt-OUT cuesta una línea y mantiene flexibilidad.
- **Sustituir el env var por un setting persistido en SQLite** (`mainnet_unlocked: bool`, configurable desde una página "Advanced settings"): considerado pero descartado por overengineering — para 10 usuarios self-hosted, una env var es perfectamente adecuada al caso de uso restante (CI / scripts).

---

## ADR-027 — Mainnet como default + RPC canónicas por red

**Fecha**: 2026-05-21
**Estado**: Aceptada · complementa [ADR-026](#adr-026--mainnet-gate-abierto-por-defecto-la-confirmaci%C3%B3n-de-ui-es-la-safety-net)

**Contexto**: Tras ADR-026 (gate abierto por defecto), el siguiente paso de coherencia era el default mismo. Hasta ahora la herramienta arrancaba en `network=devnet` con la URL pública de devnet, asumiendo que el usuario "validaría primero en test" antes de pasarse a mainnet. En la práctica eso convierte el primer arranque en una experiencia de juguete: las posiciones reales del usuario no aparecen, los precios no son los del pool en vivo, y todo huele a entorno de desarrollo. La inversión natural era: arrancar en mainnet (el caso de uso real) y dejar test mode como opción no-default.

Además, había un problema operativo independiente: el campo `rpcUrl` se guardaba como un único valor compartido entre redes. Al cambiar de red por la UI, el `rpcUrl` no se actualizaba, así que el usuario quedaba con un Helius mainnet apuntando a una red devnet o viceversa — falla con un error críptico en el primer auto-exit que intenta crear.

**Decisión**:

1. **Default `network = "mainnet"`** en `DEFAULTS` del router de settings, y `rpcUrl = "https://api.mainnet-beta.solana.com"` (el endpoint canónico público).
2. **Fallback del cliente** (`packages/web/src/lib/constants.ts`: `NETWORK` y `RPC_URL`) alineado al mismo default — para el breve momento en que la query de settings no ha resuelto.
3. **Campo nuevo en el snapshot tRPC**: `defaultRpcByNetwork: { mainnet, devnet }`. Expone las URLs canónicas para que la UI las consuma (placeholder dinámico, link "use default", auto-swap).
4. **Auto-swap del rpcUrl al cambiar de red**: si el `rpcUrl` actual coincide con el default de la red anterior (i.e., el usuario nunca lo customizó), al togglear se sobrescribe con el default de la nueva red. Si tiene una URL custom (Helius personal, por ejemplo), no se toca — la copy del campo le avisa de que la revise.
5. **Botón "use \<network\> default"** junto al campo de RPC URL — aparece solo si el valor actual difiere del canónico. Click → vuelve al canónico.
6. **Read del network respeta lo stored**: ADR-026 había hecho `isMainnetGateAllowed()` siempre `true`, lo que volvía irrelevante el "force devnet on locked gate". Ahora el snapshot devuelve estrictamente lo guardado en SQLite si es válido, cayendo a `DEFAULTS.network` solo si la key está ausente (fresh install o reset).

**Consecuencias**:
- (+) Onboarding alineado con el caso de uso real: el usuario abre la herramienta, ve sus posiciones LP de Orca/Meteora mainnet, y configura un auto-exit. Sin pasos previos de "primero juguetea en devnet".
- (+) El `rpcUrl` y la red ya no se desincronizan al toggle. Cero tasks "fantasma" creadas con RPC equivocada.
- (+) Test mode sigue disponible y bien identificado: la UI muestra TEST / REAL con sus URLs canónicas; el doc explica que test usa Solana devnet y que se puede customizar.
- (+) Para usuarios existentes que ya guardaron `network=devnet` o un `rpcUrl` custom, **nada cambia** — el snapshot respeta el valor stored. El cambio solo aplica a fresh installs y a quienes hacen "Reset to defaults".
- (−) Mainnet por defecto significa que el usuario nuevo puede crear un auto-exit con fondos reales sin haber probado en devnet. La doble confirmación de UI (ADR-026) y el toggle simulation (ya retirado de la UI, ADR-026 hold) son las protecciones. Si el usuario lee la página de docs/auto-exit#when-the-close-fails antes de ejecutar, ya tiene contexto.
- (−) La URL pública `api.mainnet-beta.solana.com` está fuertemente rate-limited y no es viable para sostener watchers. La copy bajo el campo deja claro que se debe sustituir por Helius / Triton / QuickNode / nodo propio. Aceptado: el default funciona para el primer arranque y "ver que la herramienta lee tus posiciones", luego el usuario sustituye.
- (−) Si en el futuro hace falta volver a defaultar devnet (por ejemplo, para una versión "educativa" o demos públicas), es cambio de una línea en `DEFAULTS`.

**Alternativas consideradas**:
- **Detectar la red a partir del RPC URL configurado** (parseando "mainnet" / "devnet" en la URL): rechazado por brittle — los RPCs custom de Helius/Triton no tienen el nombre de la red en la URL.
- **Setup wizard al primer arranque** que pregunte al usuario qué red quiere: rechazado por overhead UX para un default que el 95% va a aceptar tal cual.
- **Default a "no network seleccionada"** forzando al usuario a elegir explícitamente: rechazado — añade un paso bloqueante que no aporta nada para el caso de uso primario.
- **Persistir el `rpcUrl` por red** (dos columnas: `rpcUrl_mainnet`, `rpcUrl_devnet`): considerado, descartado por overengineering. El auto-swap heurístico cubre el 99% del caso; los pocos que tengan custom URLs para ambas redes van a recordarlo manualmente.

---

## ADR-028 — Vitest como framework de tests, unit puros + integration sqlite `:memory:`

**Fecha**: 2026-05-21
**Estado**: Aceptada

**Contexto**: El repo arrancó sin tests automatizados (decisión consciente: priorizar el chaining de fases F1-F6 sobre infraestructura de testing). Tras cerrar F6 y antes de abrir el repo a público, una auditoría QA + security identificó hallazgos críticos (race conditions en el watcher, validaciones cruzadas, edge cases de fetch) que justificaban un sprint dedicado a coverage automatizada. Elegir el stack pasó por decidir tres ejes: framework de tests, estilo de tests (unit puros vs integration con dependencias reales) y qué se mockea.

**Decisión**:

1. **Vitest 4 como framework**. Sobre `node:test` (built-in Node 22+) y Jest:
   - Frente a `node:test`: mejor DX (watch mode, parallel by default, snapshot, mocks built-in via `vi.fn()`, fake timers ergonómicos, reporters ricos), `tsx`-friendly sin loader extra, soporta TypeScript ESM nativo.
   - Frente a Jest: más rápido en monorepos pnpm, mejor configuración por workspace, sin necesidad de `ts-jest` ni `babel-jest`. La penalización de añadir Vitest como devDep (~20 MB transitivos) compensa con creces el ahorro de boilerplate.
2. **Estructura por capa**, no por kind. Cada test vive al lado del módulo que prueba:
   - `packages/server/src/security/rpc-url.test.ts` junto a `rpc-url.ts`.
   - `packages/server/src/tasks/buffer.test.ts` junto a `buffer.ts`.
   - Vitest config glob: `packages/*/src/**/*.{test,spec}.ts`.
3. **Unit puros para funciones puras**, sin mocks salvo `fetch` global cuando es relevante.
4. **Integration tests con `sqlite :memory:` real** + `migrate(db, { migrationsFolder })` apuntando a los `.sql` versionados. No mockear Drizzle ni SQLite — el coste de spinning up una DB en memoria es ~5ms y los tests cubren el path real (queries, constraints, JSON serialization, foreign keys con cascade).
5. **No mockear `node:crypto`**. El vault test suite usará scrypt real (N=32768 ~50-100ms/unlock). Aceptable para los pocos tests que ejercen el vault; alternativa (mock crypto) introduciría drift entre tests y producción.
6. **Mock solo lo que toca red**: `fetch` global via `vi.stubGlobal("fetch", ...)`. SDKs de Orca/Meteora serán mockeados cuando se escriban adapter tests (lo cuál es no-trivial — `setRpc` de @orca-so/whirlpools es estado global del SDK; ver TODO).
7. **Acceso a métodos privados** via cast `(mgr as unknown as { method: ... })` cuando los tests integration necesiten ejercer guards internos (B-01). Pragmático; alternativa sería hacer `protected` y heredar en test, más boilerplate.

**Consecuencias**:
- (+) Baseline de 53 tests cubriendo seguridad (rpc-url + unlock-limiter), máquina de estados del watcher (buffer + manager.markError) y RPC parsing (verify). Suite completo ~1.8s.
- (+) CI workflow (`.github/workflows/ci.yml`) corre `pnpm test` en cada push. Regresiones en estos paths se detectan automáticamente.
- (+) `evalBuffer` extraído a módulo puro durante este sprint — la búsqueda de testabilidad mejoró el diseño.
- (−) Coverage parcial. Quedan sin tests: `wallet/vault` (cripto), adapters Orca/Meteora (requieren SDK mocks), `engine/core/{retry,loop}`, lifecycle completo de `TaskManager` (boot, pauseAllOnVaultLock, transiciones), routers tRPC. Documentado en TESTING.md y en TODO.
- (−) Los tests integration con `:memory:` no detectan problemas de concurrencia real (SQLite WAL, multiple writers). Aceptable porque el server es single-process.

**Alternativas consideradas**:
- **Jest**: descartado por DX inferior en monorepos pnpm y peor soporte ESM TS.
- **`node:test`**: descartado por DX (sin watch ergonómico, mocking spartan via `node:test`'s `mock`, sin coverage v8 integrado). Para un proyecto que va a abrir contribuciones, Vitest es la elección estándar de la comunidad.
- **Solo unit tests, sin integration**: descartado. La race condition B-01 solo es testeable con DB real porque depende del status persistido.
- **Tests E2E con devnet real**: considerado, queda como manual smoke test (los scripts `scripts/probe-*.ts` ya cumplen ese rol). Añadir CI E2E requeriría un test wallet financiado en devnet + flaky network — no compensa.

---

## ADR-029 — Tauri sidecar pattern: server Node empaquetado con Bun `--compile`

**Fecha**: 2026-05-21
**Estado**: Superada por [ADR-031](#adr-031--el-sidecar-tauri-no-usa-bun---compile-runtime-bun--pnpm-deploy) en cuanto al empaquetado `--compile`. El patrón sidecar, la comunicación HTTP y la resolución de paths por Rust (puntos 1, 5, 6) siguen vigentes.

**Contexto**: F4.1.a montó el shell Tauri vacío. F4.1.b debía cerrar el bucle: empaquetar el backend Node (Hono + tRPC + Drizzle + better-sqlite3) dentro del bundle desktop para que el usuario final no necesite Node ni pnpm. La frontera del problema: convertir un workspace TypeScript con ~200 MB de `node_modules` en un único binario ejecutable.

**Decisión**:

1. **Sidecar pattern, no embedding**. El server NO se ejecuta dentro del proceso Tauri (Rust) — se lanza como **child process separado** vía `tauri-plugin-shell` desde el `setup()` del Tauri lib.rs. Tauri solo orquesta: spawn al arrancar, kill al cerrar (`RunEvent::Exit`), pipe stdout/stderr al log del shell.
2. **Bun `bun build --compile` como empaquetador**. Sobre Node SEA, `pkg`, `nexe`:
   - Bun produce un binario único que embebe el runtime + el código + los `node_modules` resueltos. Maneja módulos nativos (`better-sqlite3`, módulo C++) razonablemente bien — los `.node` se copian junto al binary o se embeben según el target.
   - Frente a Node SEA: SEA requiere bundling externo (esbuild + post-build) y copy manual de `.node` files. Más fricción de build por target. Aceptable pero más fragil.
   - Frente a `pkg`/`nexe`: ambos llevan años sin mantenimiento activo y son notorios por problemas con módulos nativos modernos. Rechazados.
3. **Naming convention `auto-exit-server-<target-triple>[.exe]`** en `packages/tauri/binaries/`. Tauri exige ese sufijo para resolver el binary correcto del host. Script `packages/server/scripts/build-binary.ts` (cross-platform invoker) detecta `process.platform-process.arch` y mapea al `target-triple` Rust style + al `bunTarget` apropiado.
4. **Migrations como Tauri resources**, no embebidas. El server actual lee `packages/server/drizzle/*.sql` de filesystem en `runMigrations()` via env `DRIZZLE_MIGRATIONS`. El script de build copia ese folder a `packages/tauri/binaries/drizzle/`; `tauri.conf.json` lista `binaries/drizzle/*` en `resources`; Tauri lo resuelve via `app.path().resource_dir()` y se lo pasa al sidecar en `DRIZZLE_MIGRATIONS` env var. Cero cambios en el código del server.
5. **Comunicación HTTP, no IPC**. El sidecar sigue escuchando en `127.0.0.1:7777` (igual que en dev). El webview de Tauri carga el frontend bundled (`tauri://localhost`) que llama al server via fetch tRPC. CORS extendido para `tauri://localhost`. Pros: cero refactor del cliente tRPC + dev-mode y prod-mode son idénticos.
6. **Paths runtime resueltos por Tauri Rust**, no hardcoded. `app.path().app_data_dir()` (writable, per-OS) para `DB_PATH` + `WALLET_VAULT_PATH`. `app.path().resource_dir()` para `DRIZZLE_MIGRATIONS`. Los env vars se setean en el spawn del sidecar.
7. **Compile en el host de destino**. Cross-compile Bun → otros OSes es teóricamente posible pero deja módulos nativos sin compilar correctamente. Política: el maintainer (o CI por plataforma) compila el binary en la OS donde correrá. Para distribución multi-OS: GitHub Actions matrix con workers Windows/macOS/Linux, cada uno produce su `.exe`/`.dmg`/`.AppImage` con su sidecar nativo. Futuro F4.2.

**Consecuencias**:
- (+) El usuario final descarga un instalador (`.msi`, `.dmg`, `.AppImage`) y double-click. Cero deps a instalar. La promesa "self-hosted no-custodial" se mantiene íntegra (la app sigue corriendo localhost, la clave sigue cifrada en disco).
- (+) Cero cambios en el código del server. Las env vars que ya existían (`DB_PATH`, `WALLET_VAULT_PATH`, etc.) son la API entre Rust shell y Node sidecar.
- (+) Migrations versionadas en repo + bundled como resources = el primer arranque del desktop crea la DB con el schema correcto sin requerir `drizzle-kit` ni Node ni nada del entorno de dev.
- (−) El binary del sidecar pesará ~50-80 MB (Bun runtime + node_modules consolidados). Aceptable para distribución desktop pero engorda el `.msi`/`.dmg`.
- (−) Dev experience requiere instalar Bun + Rust + OS build tools. Documentado en README + TODO. No bloquea el flujo `pnpm dev:server` + `pnpm dev:web` actual.
- (−) Cross-compile no es viable, así que la matriz de release requiere CI multi-OS — fricción extra para F4.2.

**Alternativas consideradas**:
- **Embedded Node via N-API en Rust** (ejecutar el código Node dentro del proceso Tauri): rechazado por complejidad masiva y por romper el modelo claro de proceso separado (debugging y crash isolation son trivial con sidecar; quedan turbios con embed).
- **Reescribir el server en Rust** (Hono → axum, Drizzle → diesel, etc.): rechazado por el coste — sería F8+, no F4.1.b. La capa Node es ya estable y testeada.
- **Distribuir el server como Docker compose + el frontend como electron/webview** apuntando a localhost:7777: rechazado porque exige al usuario instalar Docker (no es razonable para distribución amigo).
- **Tauri "bundled webview only", sin sidecar** (Tauri carga el frontend, el usuario arranca el server manualmente): rechazado, contradice el goal de "double-click and it just works".

---

## ADR-030 — Next.js `output: 'export'` con `generateStaticParams` placeholder

**Fecha**: 2026-05-21
**Estado**: Aceptada

**Contexto**: Para que Tauri bundlee el frontend Next.js como HTML estático (sin servidor Node corriendo dentro de Tauri sirviendo HTML — eso lo hace el sidecar separado), Next.js debe estar configurado con `output: 'export'`. Pero el repo tiene dos rutas dinámicas en App Router:

- `app/positions/[mint]/page.tsx`
- `app/tasks/[id]/page.tsx`

El `mint` y el `id` son valores que el usuario descubre en runtime (sus posiciones LP, sus auto-exits creados) — NO se conocen at build time. Next.js con `output: 'export'` exige que cada ruta dinámica tenga `generateStaticParams` que devuelva al menos un path; ese path se materializa como un HTML estático que el cliente puede cargar.

**Decisión**:

1. **Opt-in del export via env var `TAURI_BUILD=1`**. `next.config.ts` lee `process.env.TAURI_BUILD === "1"` y solo en ese caso activa `output: 'export'`. El dev mode normal (`pnpm dev:web`) y el build Docker no se ven afectados. Un solo source de config; evita drift de mantener dos `next.config.*.ts` paralelos.
2. **Rutas dinámicas split en Server Component shim + Client Component**:
   - `page.tsx` (Server Component, sin `"use client"`): exporta `generateStaticParams()` devolviendo `[{ mint: "_" }]` (o `[{ id: "_" }]`) — un placeholder único. Exporta `dynamicParams = false`. Renderiza `<PositionPage />` (o `<TaskPage />`) directamente, sin pasar `params`.
   - `client.tsx` (Client Component, `"use client"`): la lógica actual entera. Lee el `mint`/`id` real via `useParams()` de `next/navigation`.
3. **Static export produce `out/positions/_/index.html` y `out/tasks/_/index.html`**. Cuando el cliente navega a `/positions/<algún-mint>` via `<Link>`, Next router actualiza el URL con History API sin recargar la página — el placeholder hidrata con el `mint` real leído de `useParams()`. Funciona porque toda la nav es client-side; nunca se hace request HTTP por `/positions/<mint>`.
4. **Caveat documentado**: refresh (F5) del browser en una URL dinámica → 404 (no existe `out/positions/<real-mint>/index.html`). En Tauri esto no es un flujo común — el usuario no recarga el shell manualmente. Aceptado.
5. **`images: { unoptimized: true }`** cuando `TAURI_BUILD=1`. Next.js no puede optimizar imágenes sin runtime server.

**Consecuencias**:
- (+) Frontend bundled estáticamente, sin Node runtime ni Next server dentro de Tauri.
- (+) Cero refactor de los componentes — la lógica actual (que ya era 100% client-side con `useParams()`) sigue funcionando intacta. Solo se añadió un shim de 8 líneas por ruta dinámica.
- (+) Dev mode no cambia. `pnpm dev:web` sigue funcionando con HMR y todos los Server Components / route handlers que tenga el repo en el futuro.
- (−) Refresh en URL dinámica falla. Mitigable con custom protocol handler en Rust (Tauri 2 lo permite) o hash routing — descartado por simplicidad mientras no sea un problema real.
- (−) Si en el futuro alguna ruta dinámica necesita ser Server Component con data fetched at build time, este patrón no aplica. Hay que volver a evaluar.

**Alternativas consideradas**:
- **Cambiar `[mint]` y `[id]` a query strings** (`/positions?mint=xxx` y `/tasks?id=yyy`): elimina las rutas dinámicas a nivel de Next.js. Rechazado por requerir refactor de TODOS los `<Link href="...">` y `router.push(...)` del proyecto + romper URLs existentes que el usuario tenga bookmarkeadas.
- **Hash routing puro** (`/#/positions/<mint>`): Next.js no lo soporta nativamente; requeriría rehacer la capa de routing. Rechazado por coste.
- **Custom Tauri protocol handler** (rewrite todas las rutas no encontradas a `index.html`): viable pero añade código Rust no trivial. Reservado para si el caveat del refresh se vuelve molesto.
- **Server Components que reciban `params` y pasen el mint al Client**: cosmético, no resuelve el problema fundamental (Next sigue exigiendo `generateStaticParams`).

---

## ADR-031 — El sidecar Tauri no usa `bun --compile`: runtime Bun + `pnpm deploy`

**Fecha**: 2026-05-22
**Estado**: Aceptada · supersede el empaquetado de [ADR-029](#adr-029--tauri-sidecar-pattern-server-node-empaquetado-con-bun---compile)

**Contexto**: [ADR-029](#adr-029--tauri-sidecar-pattern-server-node-empaquetado-con-bun---compile) decidió empaquetar el server como binario único con `bun build --compile`. Al verificar el build F4.1.b end-to-end (instalando Bun + Rust + MSVC Build Tools), el enfoque resultó inviable. El patrón sidecar, la comunicación HTTP por `127.0.0.1:7777`, el naming `auto-exit-server-<triple>` y la resolución de paths por Rust (puntos 1, 5, 6 de ADR-029) se mantienen intactos; lo único que cae es el empaquetado `--compile`.

**Los tres muros de `bun --compile`** (cada uno verificado ejecutando el binario resultante):

1. **`better-sqlite3` (módulo nativo)**: usa el paquete `bindings`, que en runtime recorre el filesystem buscando un `node_modules` para localizar su `.node` — layout inexistente dentro de un binario compilado.
2. **`@orca-so/whirlpools-core` (WASM)**: glue de wasm-bindgen. (a) El bundler de Bun lo malclasifica como ESM y rompe su `module.exports` — emite una referencia a un namespace que nunca declara; (b) su `.wasm` se carga con `readFileSync(__dirname + ...)` en runtime, invisible para `--compile`. Marcarlo `--external` tampoco sirve: un binario `bun --compile` no resuelve módulos externos desde disco (filesystem virtual sellado; ignora cwd y `NODE_PATH`).
3. **`@meteora-ag/dlmm`**: el engine lo carga vía `createRequire` ([ADR-024](#adr-024--coexistencia-de-sdks-solana-en-los-adapters--workaround-esmcjs-de-anchor), workaround del bug ESM de anchor). El bundler nunca ve ese require, así que el paquete queda fuera del bundle pase lo que pase.

Conclusión: con dependencias WASM + nativas + cargadas por `createRequire`, **sólo un `node_modules` real en disco funciona**.

**Decisión**:

1. **Driver SQLite dual por runtime**. `packages/server/src/db/client.ts` ramifica según `process.versions.bun`:
   - Bun (el sidecar) → `bun:sqlite` + `drizzle-orm/bun-sqlite`. `bun:sqlite` va embebido en el runtime de Bun: cero módulos nativos.
   - Node (dev `tsx`, Docker, Vitest) → `better-sqlite3` + `drizzle-orm/better-sqlite3`.
   Imports dinámicos para que ningún runtime resuelva el módulo del otro; los specifiers de la rama Bun llevan `as string` para que TypeScript no exija `@types/bun`. El tipo `Db` exportado es el de better-sqlite3 — ambos drivers exponen la misma API de query de drizzle.
2. **El sidecar no se compila**. `packages/server/scripts/build-binary.ts` produce, en `packages/tauri/binaries/`:
   - `auto-exit-server-<triple>[.exe]` — copia del ejecutable `bun` (el runtime ES el sidecar).
   - `server-app/` — el server desplegado con `pnpm deploy --legacy --prod` (código + `drizzle/` + un `node_modules` real con todo el árbol de deps).
   El `setup()` de Rust hace spawn del runtime Bun pasándole `server-app/src/main.ts` como argumento; Bun resuelve las deps desde `server-app/node_modules`.
3. **Pruning del deploy**: `data/` (contiene la DB y el `wallet.vault` de desarrollo — secreto que NO debe distribuirse), `scripts/` y `drizzle.config.ts` se eliminan del `server-app/`.
4. **Resolución de `server-app/` por entorno** en `lib.rs`: en debug (`tauri dev`) se lee de `CARGO_MANIFEST_DIR/binaries/server-app` sin pasar por el mecanismo de `resources` de Tauri; en release, de `resource_dir()`.
5. **Patch de `@orca-so/whirlpools-core`** vía `pnpm patch`: añade `"type": "commonjs"` explícito a su `dist/nodejs/package.json` (el build CJS de wasm-bindgen viene sin etiquetar, bajo un `package.json` raíz con `"type": "module"`) para que el runtime de Bun cargue el paquete sin ambigüedad.

**Consecuencias**:
- (+) El build F4.1.b verifica end-to-end: el sidecar arranca y sirve, con Orca, Meteora y SQLite resolviendo correctamente.
- (+) `pnpm deploy` materializa las versiones exactas del lockfile — el sidecar corre el mismo árbol de deps que se testea, sin divergencia dev/prod.
- (+) Cero bundler en el camino del sidecar → cero bugs de bundler con WASM / native / `createRequire`.
- (+) `bun:sqlite` es más rápido que `better-sqlite3` y no necesita toolchain de compilación nativa.
- (−) Footprint mayor: ~98 MB (runtime Bun) + ~174 MB (`server-app/`) ≈ 272 MB, frente a los ~100 MB que prometía el binario único de ADR-029.
- (−) `server-app/node_modules` usa el layout `.pnpm` (store + junctions, con paths >260 chars). Funciona en sitio para `tauri dev`; el instalador relocatable de `tauri build` necesitará aplanarlo. `--node-linker=hoisted` en el deploy no es viable — pnpm lo trata como cambio de config y fuerza un purge del `node_modules` del workspace. Pendiente de F4.2.
- (−) `better-sqlite3` viaja en el `server-app/` aunque el sidecar Bun nunca lo use, porque sigue siendo dependencia del server para el path Node/Docker. Peso muerto podable.
- (−) Tocar dependencias del server obliga a re-ejecutar `build-binary.ts` para regenerar `server-app/`.

**Alternativas consideradas**:
- **`bun --compile` + `--external` para las deps WASM/nativas**: descartada — Muro 3, el binario compilado no resuelve externals desde disco.
- **`bun --compile` parcheando Orca** (forzar CJS + reescribir la carga del `.wasm` a import estático): rewrite frágil de glue generado por wasm-bindgen, y Meteora seguiría sin poder bundlearse (Muro 3 de Meteora vía `createRequire`).
- **Bundle con `bun build` sin `--compile` + runtime Bun**: el bundler tiene el mismo bug con Orca y tampoco ve el `createRequire` de Meteora — habría que externalizar medio árbol de deps igualmente. `pnpm deploy` produce ese `node_modules` de forma más limpia y con las versiones exactas del lockfile.
- **Reescribir el server en Rust**: fuera de alcance (sería F8+), igual que se descartó en ADR-029.

---

## ADR-032 — Auto-update con tauri-plugin-updater (builds unsigned)

**Fecha**: 2026-05-22
**Estado**: Aceptada

**Contexto**: F4.2 distribuye la app como builds **sin codesign del SO** a un grupo pequeño de amigos técnicos, vía GitHub Releases. Sin auto-update, cada versión nueva exigiría reinstalación manual. Hace falta un mecanismo de actualización que no dependa del codesign de Apple/Microsoft.

**Decisión**:

1. **`tauri-plugin-updater`**. Su esquema de firma (minisign, keypair propia) es **independiente del codesign del SO** — funciona con builds unsigned. El plugin descarga el instalador nuevo, verifica su firma contra la pubkey embebida, y lo aplica.
2. **Check desde Rust en `setup()`, no desde el frontend**. El frontend es un static export y está en rediseño; un check Rust-side no lo acopla y no requiere `@tauri-apps/plugin-updater` ni tocar la web.
3. **UX: preguntar, nunca auto-reiniciar**. Al arrancar se comprueba si hay versión nueva; si la hay, un diálogo nativo (`tauri-plugin-dialog`) pregunta antes de instalar. Instalar reinicia la app, y un reinicio detiene los watchers de auto-exit activos — la decisión del momento debe ser del usuario.
4. **El keypair lo genera y custodia el maintainer**. La clave pública va en `tauri.conf.json` (commiteada — es pública). La privada **nunca pasa por el repo**; se inyecta en el build de release via `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
5. **`createUpdaterArtifacts` NO va en el `tauri.conf.json` commiteado**. Activarlo ahí obligaría a tener la clave de firma en cualquier `tauri build` (lo rompería para contributors). Se activa solo en el build de release con `--config tauri.updater.conf.json`. `plugins.updater` (pubkey + endpoints) sí va commiteado: el app lo necesita para verificar updates en runtime.
6. **Hosting en GitHub Releases**. El endpoint apunta a `releases/latest/download/latest.json`. Tauri NO autogenera `latest.json` — el proceso completo está en [RELEASING.md](RELEASING.md).

**Consecuencias**:
- (+) Auto-update real sin pagar el codesign de Apple/Microsoft.
- (+) El frontend no se toca — el check vive en Rust.
- (+) Nunca se interrumpe un watcher sin permiso del usuario.
- (−) `tauri build` normal no produce artefactos de update; el release es un build aparte (`--config`) con las env vars de firma.
- (−) `latest.json` se escribe a mano (o con script) en cada release — Tauri no lo genera.
- (−) La seguridad del canal de update depende de la custodia de la clave privada por el maintainer.

**Alternativas consideradas**:
- **Sin auto-update, reinstalación manual**: descartada — fricción en cada versión.
- **Check desde el frontend** (`@tauri-apps/plugin-updater`): acopla el updater al frontend en rediseño; el check Rust-side es más limpio.
- **Auto-instalar en silencio**: descartada — reiniciar sin avisar puede dejar una posición sin su watcher de stop-loss.
- **`createUpdaterArtifacts: true` permanente en el config**: rompería `tauri build` para cualquiera sin la clave de firma.
