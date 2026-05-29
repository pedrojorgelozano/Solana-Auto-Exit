# TODO

## En curso

(nada activo)

## Próximo (orden sugerido)

- [ ] **F5** — LAN access opcional (token de pareja) + service-of-OS sidecar
  (launchd / systemd / Windows Service) para 24/7 sin Tauri abierto.
  Notificaciones Telegram opcional.
- [ ] **Publicar release `v0.2.0`** — el rediseño UI está mergeado a
  `main` y pusheado. Cambio visual mayor (paleta dark + sidebar +
  hub visual + alerts contextuales + bulk-resume + /tasks como
  histórico + wallet polish + etc.) → semver minor bump. Seguir
  [docs/RELEASING.md](RELEASING.md) para el proceso (keypair de
  firma, `pnpm tauri:release`, artefactos `.exe`/`.msi`/`latest.json`/
  `SHA256SUMS.txt`, crear GitHub Release). La sección `[Unreleased]`
  del CHANGELOG ya tiene todas las entries para arrastrar al
  `## [0.2.0]`.

## Backlog (sin orden)

- [ ] **Snapshot-check del bulk-resume tras desbloquear**. Hoy el callout
  `N AUTO-EXITS PAUSADOS AL BLOQUEAR LA WALLET` + botón `REANUDAR
  TODOS` reanuda **todas** las tasks paused-por-sistema sin distinguir
  cuáles cruzaron trigger durante el lockdown. Si una posición cruzó
  TP/SL mientras la wallet estaba bloqueada, el resume disparará un
  cierre inmediato. Mejora: comparar `currentPrice` contra triggers de
  cada candidata; partir el callout en dos: `M REANUDABLES SIN RIESGO
  [REANUDAR ESTOS]` + `K CRUZARON TRIGGER — REVISA ANTES [VER TASK →]`.
  Requiere getSummary o similar para cada paused. No urge — los buffers
  suelen amortiguar el problema, pero merece la pena tras feedback de
  uso real.
- [ ] Paginación del `/tasks` (Histórico). Hoy `trpc.tasks.list` carga
  TODAS las filas y el HistoryLedger las renderiza todas a la vez.
  Para usuarios casuales (1 task/mes) no es problema; para un power
  user con varios cientos de tasks históricas tras meses de uso el
  render se vuelve lento y el scroll infinito. Añadir paginación
  server-side (LIMIT/OFFSET o cursor-based) en `tasks.list` con
  default 100 + UI tipo "load more" o paginador. Trigger razonable:
  cuando un usuario tipo "power" empiece a notar lentitud, o
  preventivamente cuando `historicalRows.length > 100`.
- [ ] Health check del tamaño del archivo SQLite. Si supera N MB
  (sugerido 50 MB como threshold inicial — uso normal son <2 MB/año),
  mostrar callout amber en el dashboard: "Tu DB pesa X MB — esto es
  inusual para uso normal y puede indicar un bug. [Exportar histórico
  y limpiar]". Es defensa contra un bug futuro que llene la DB sin
  querer (e.g. un `appendHistory` en el polling loop). Añadir endpoint
  `meta.dbSize` que devuelva `statSync(DB_PATH).size`, comparar contra
  threshold en `DashboardAlerts`. Bonus: exportar histórico a CSV
  desde `/settings` antes de wipear (`scripts/seed-history.ts
  --wipe-all` es el wipe pero hoy no hay export).
- [ ] Documentación en español. Todos los docs públicos del repo
  (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/INSTALL.md`,
  `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/RELEASING.md`,
  `docs/SECURITY-AUDIT.md`, `docs/TESTING.md`, `docs/TODO.md`) están
  en inglés. La app interna sí es bilingüe EN/ES (i18n completo en
  `/docs/*` y toda la UI), pero un usuario hispanohablante que aterriza
  en el repo se topa con instalación / seguridad / arquitectura en
  inglés. Plan razonable cuando se aborde:
  - Priorizar los que toca el usuario final (`README.md`, `INSTALL.md`,
    `SECURITY.md`). Los técnicos profundos (`ARCHITECTURE.md`,
    `DECISIONS.md`, `SECURITY-AUDIT.md`) son audiencia developer
    internacional → quizá no merecen traducción dual.
  - Estrategia: archivos paralelos (`README.es.md` al lado de
    `README.md`) o subcarpeta (`docs/es/`). El primero es la
    convención de muchos proyectos (Vue, Vite, etc.).
  - Mantener la versión EN como source-of-truth para no acumular
    drift; las ES se actualizan cuando hace falta.
- [ ] Investigar / filtrar `ConnectTimeoutError` a
  `api.{mainnet-beta,devnet}.solana.com:443` ("Error getting chain ID from
  genesis hash") que aparece en logs del server al arrancar, incluso con
  un `rpcUrl` custom configurado. Sospecha: algún SDK (Orca o Meteora)
  hace un probe inicial contra las URLs públicas por defecto. No afecta a
  la funcionalidad (todo el flujo de cierre/swap usa el RPC del usuario);
  ensucia los logs y es ruido confuso para self-hosters detrás de firewall.
- [ ] Migrar los artículos de `/docs` de TSX hardcoded a markdown single-source.
  Hoy `packages/web/src/app/docs/{slug}/page.tsx` contiene el copy inline;
  cuando el contenido crezca o queramos servir el mismo texto desde el
  GitHub README, mover a `docs/user-guide/*.md` y renderizar con
  `react-markdown` o MDX. Coste de mantenimiento bajo mientras los
  artículos sean pocos y estables.
- [ ] Diff threshold del receipt configurable. Hoy el ActualLine de F2.3
  colorea warning si `|diff| ≥ 0.01%` hardcoded. Mover a `/settings` como
  `diffWarningThresholdBps` (o equivalente).
- [ ] Optimizar `MeteoraAdapter.getPositionSummary`: hoy llama
  `DLMM.getAllLbPairPositionsByUser` (recorre todas las posiciones del
  owner) cada vez. Para una wallet con N posiciones DLMM es O(N) por
  cada `/tasks/[id]` que carga summary. Usar `wrapPosition(program,
  key, accountInfo)` del SDK con el `AccountInfo` ya fetched para hacer
  un solo decode dirigido.
- [ ] Persistir `tokenMintA/B` en `protocolConfig` también para Meteora
  cuando F6.2 abra el flujo de tasks. F2.4 lo hizo para Orca; el receipt
  y la heurística del Dashboard asumen estos campos.
- [ ] Bundlear SVGs reales de los logos de tokens en
  `packages/web/public/tokens/<symbol>.svg`. Hoy `TokenBadge` renderiza
  placeholders coloreados (círculo + 1-2 letras del símbolo, color del
  registry o hash del mint). Para que se vea "como Orca/Meteora" hay que
  descargar los SVGs oficiales de los 10-20 tokens más usados y servirlos
  desde local (sin egress externo, alineado con el threat model). Después
  `TokenBadge` puede priorizar `/tokens/<symbol>.svg` y caer al placeholder
  solo si no hay archivo. Apuntado al rediseño UI (feature/ui-refined-dark).
- [ ] Expandir el token registry de `packages/web/src/lib/tokens.ts` con
  más mints conocidos (devnet Orca pools varios, otros stables de mainnet,
  LSTs adicionales, memes populares). Posiblemente cargar de Jupiter token
  list en background — trade-off con la política "no external assets" del
  threat model.
- [ ] Cierre + swap atómico en una sola tx (combinar `closePositionInstructions`
  + `swapInstructions` + `buildAndSendTransaction` de `@orca-so/tx-sender`).
  Elimina el riesgo de slippage entre las dos tx.
- [ ] Anti-flapping: confirmar el trigger durante N ciclos antes de cerrar.
- [ ] `EXIT_TOKEN_MINT` con tokens FUERA del pool (vía Jupiter en mainnet,
  multi-hop). Hoy solo mismo pool (ADR-008).
- [ ] Ampliar cobertura de tests (baseline actual: 53 con Vitest — security
  + buffer + verify + manager.markError). Pendientes priorizados:
  `wallet/vault.ts` cripto roundtrip + bad-passphrase distinguible de
  tampered, `engine/core/{retry,loop}.ts` + `engine/config/env.ts`,
  lifecycle completo de `TaskManager` (`boot()` re-pausa stale states,
  `pauseAllOnVaultLock`, transiciones atómicas con DB en transaction),
  adapters Orca + Meteora con SDK mocks, routers tRPC vía
  `appRouter.createCaller(ctx)`. Detalle en [TESTING.md](TESTING.md).
- [ ] Auto-lock del wallet por inactividad (configurable; default 30 min sin
  operaciones). Hoy no hay timeout.
- [ ] Sustituir el spawn `shell: true` del probe-e2e por `cross-spawn` o
  invocación directa de `node + tsx` para evitar DEP0190.
- [ ] Cifrado opcional del SQLite del server (SQLCipher) para entornos donde
  el disco no esté full-disk-encrypted.
- [ ] Validación en backend de "un auto-exit activo por posición" (hoy solo
  en UI). Es espejo de la regla — añadir refine en `tasks.create` o
  check explícito en `TaskManager.createTask`.
- [ ] Manejo explícito de buffer de fees al swapear SOL nativo (hoy delegamos
  al `nativeMintWrappingStrategy` del SDK).
- [ ] Métricas / observabilidad: logs estructurados (JSON), opción de
  exportar a fichero rotado o Prometheus.
- [ ] Reportar upstream el bug de `tauri-plugin-dialog` 2.7.1: su
  `init-iife.js` sobrescribe `window.confirm` para invocar el comando
  `plugin:dialog|confirm`, que esa versión ya no registra. Mitigado en
  local con `confirm_fix_plugin` ([ADR-034](DECISIONS.md)); si upstream
  lo arregla, retirar el workaround.
- [ ] `build-binary.ts` no poda los `*.test.ts` del `server-app/`
  desplegado — peso muerto en el bundle del instalador. Añadirlos a la
  poda (junto a `data/`, `scripts/`, `drizzle.config.ts`).
- [ ] Empaquetar la app desktop para macOS y Linux. El release v0.1.0 es
  solo Windows — `tauri build` no hace cross-compile del instalador, así
  que requiere buildear en cada SO (o un CI con runners macOS/Linux).
- [ ] Verificar el flujo real de auto-update: descargar e instalar una
  versión nueva vía el updater. Solo se puede probar con una v0.1.x
  posterior publicada, con el opt-in activado.
- [ ] **Hallazgos QA audit NO aplicados** (de la auditoría conjunta peer +
  self review). Documentados con archivo:línea + mecanismo + fix
  propuesto en la sesión correspondiente. Por orden de impacto:
  - B-04: `update tasks` + `appendHistory` no atomicos (sin
    transacción). Si el server crashea en medio, history queda
    inconsistente. Wrap pares en `db.transaction()`.
  - B-05: `withRetry` reintenta CUALQUIER error 5 veces, incluidos
    permanentes (SlippageExceeded, InsufficientFunds, validaciones
    del adapter). Añadir `retryableErrors?: (err) => boolean` opcional.
  - B-07: `WalletVault.getRawSecret()` devuelve referencia mutable al
    buffer interno. Quien la reciba (Meteora adapter) puede mutarla;
    `lock()` zeroa el mismo buffer in-flight. Devolver copia.
  - B-08: `lock` durante un close en flight no cancela la tx (no
    podemos). Deshabilitar el botón Lock mientras haya tasks en
    `closing` para evitar confusión UX.
  - B-09: unlock-limiter cuenta CUALQUIER error de `vault.unlock`
    como passphrase incorrecta (incluido "vault file corrupted",
    "address mismatch"). Tipar el error en vault.ts para distinguir.
  - B-10: `verifyTxBalances` solo lee `accountKeys` del message;
    ignora `meta.loadedAddresses`. Si la wallet aparece solo en una
    LUT, `solDelta` será 0 silenciosamente.
  - B-11: Meteora `closePosition` multi-tx no compensa si tx[N+1]
    falla tras tx[N] éxito — posición queda parcialmente cerrada y
    `lastSig` apunta a la última exitosa (engaña al receipt).
  - B-14: `runMigrations` solo `console.warn` si no existe folder.
    Después las queries fallan en runtime con error críptico.
    Lanzar en su lugar.
  - B-15: `parseIntOr` permite valores negativos persistidos directo
    en DB. Clampear o rechazar.
  - B-17: `ALLOW_LOOPBACK_RPC` solo acepta literal `"true"` —
    inconsistente con `parseBool` del engine. Unificar o documentar.
  - B-20: watcher crash deja la task en `armed` sin watcher real.
    El `.catch` del spawn solo loguea; debería pasar a `error`.

## Hecho recientemente

Para el detalle de cada cambio, consultar `git log` y los commits referenciados.

- **Sprint de affordances pre-release v0.2.0 (2026-05-29)**: feedback de
  Pedro al revisar la UI — "hay un montón de botones que no tienen pinta
  de botón: simplemente son textos". Diagnóstico: botones-texto, links
  docs internos y links externos compartían el mismo `t-eyebrow muted +
  hover bright` y eran indistinguibles. Solución: 3 componentes nuevos
  (`TextAction` con underline dotted, `DocsLink` con flecha `→` automática,
  `ExternalLink` con `↗` + `target=_blank` + `rel`). Migrados ~20
  callsites en 7 archivos + ~15 strings i18n EN/ES limpiados del `→`/`↗`
  del texto. Casos especiales preservados (3 disclaimer links con
  `hover:danger`, 3 inline links accent en t-body de `/positions/[mint]`,
  icon-buttons del explorer). Incidente operacional durante el sprint:
  un `git reset --hard` para reset el tag/commit de release perdió todo
  el sprint en working tree (no estaba committed). Re-aplicado a mano.
  Lección: **commits del trabajo SIEMPRE antes de tocar versionado.**
  Commits `1ed82c1`, `050ad84`, + este (docs).
- **Pulido /wallet pre-release v0.2.0 (2026-05-29)**: dos items rápidos
  sobre `main`. (1) Live balance polling en `/wallet`: nueva fila
  `Balance · X.XXXX SOL` debajo del AddressDisplay con la wallet
  unlocked, refetch cada 60s (alineado con DashboardAlerts). Loading
  `…`, fallido `—` (sin callout — eso ya vive en el dashboard).
  (2) Rename `Recommendation` → `ScopePanel` en `wallet/page.tsx` (el
  eyebrow visible ya era "Scope" tras la pieza 2 del rediseño). Item
  snapshot-check del bulk-resume descartado de la sesión: requiere
  endpoint nuevo + queries N + UI partida, y no urge sin feedback real
  — sigue en backlog. Commit `9d206b9`.
- **Sprint de pulido post-bug del balance (2026-05-29)**: 4 commits sobre
  `main` con 5 items del backlog al hilo del bug de RPC/balance de ayer.
  (1) B-18 (`wallet.balance` valida base58 de la address — el RPC tiraba
  un error confuso enmascarando paste cortados o caracteres no-base58;
  refine con `getBase58Codec` + check 32 bytes). (2) Test RPC button en
  `/settings` (nuevo endpoint `settings.testRpc` que hace `getVersion`
  con timeout 5s, pasa por `assertSafeRpcUrl` antes del fetch; UI muestra
  OK + version + latencia o error legible). (3) Low-balance threshold
  configurable (nueva key `lowBalanceThresholdLamports` en snapshot,
  input numérico en SOL en `/settings`, `0` desactiva el callout;
  `DashboardAlerts` lee del snapshot). (4) `UpdaterPanel` placeholder
  fuera de Tauri (detección `window.__TAURI_INTERNALS__` post-hidratación;
  en Docker / pnpm-from-source renderiza copy honesto + link a
  `INSTALL.md` en vez del toggle no-op). (5) Errores zod legibles (nuevo
  helper `formatTrpcError` que extrae el primer message del
  `err.data.zodError`; aplicado en `/settings`, `/wallet`,
  `ConnectWalletModal`, `/positions/[mint]/configure`). Verificado en
  vivo con `pnpm dev`. Commits `36c8e74`, `98ac1ce`, `afc154d`, +
  este (docs).
- **Rediseño UI mergeado a main (2026-05-28)**: tras 38 commits acumulados
  en `feature/ui-refined-dark`, merge `--no-ff` a `main`. Última sesión
  añadió 7 commits funcionales sobre el rediseño anterior:
  - `9822a8c` /tasks reconvertido a histórico puro (filtros COMPLETED/
    ERRORS, default COMPLETED, `?filter=errors` deep-link desde callout
    de errores). `HistoryLedger` compartido entre /tasks y bloque
    "Histórico de transacciones" del dashboard. Wallet polish:
    `AddressDisplay` con copy + truncar + Solscan, title sin jerga.
    Sidebar nav reordenado, link al histórico dedup en el hub, back
    dinámico en /tasks/[id], `Simulado` fuera de la pill, barrido
    task→auto-exit en copy.
  - `14e6c53` fix runtime: hydration mismatch en LangProvider (initial
    state `en` + useEffect post-hydrate aplica preferencia real) y
    modal layout invisible (backdrop z-40 + panel translate(-50%,-50%)
    z-50).
  - `b272b8d` `scripts/seed-history.ts` para probar el histórico con
    datos plausibles (6 tasks done/stopped/error con timestamps
    escalonados, mainnet+devnet, con/sin swap, dry-run).
  - `efd20f6` fix server: `wallet.delete` wipea tasks de la DB (bug
    encontrado: wallet nueva heredaba tasks de la anterior). Helper
    `--wipe-all` en seed script.
  - `b5af30f` quitada CTA `AUTO-EXIT →` redundante en filas sin
    watcher (doble flecha + tres affordances apilados).
  - `0e4005a` cleanup pre-merge: borrado `GlobalHeader.tsx` huérfano +
    8 strings i18n unused (`sidebar.lockWallet/locking`,
    `home.eyebrow.{botWallet,locked,onePosition,manyPositions,
    loadingPositions,oneWatching,manyWatching}`).
  - Docs sync (este commit) + merge a main + push.
  Release `v0.2.0` queda pendiente (sigue [RELEASING.md](RELEASING.md)).
- **Dashboard hub rewrite + alerts inteligentes (2026-05-28)**: 3 commits
  funcionales sobre `feature/ui-refined-dark`. Sidebar brand mark de
  monograma `A` en mono (el icono anterior era logout universal). Token
  badges placeholder ocultos con kill-switch hasta tener SVGs reales.
  Rewrite del hub del home: filas como cards elevadas cuando active /
  rows planas cuando paused/none, con header (par + pills + StatusPill
  enriquecida), big number del precio + nuevo componente `TriggerBand`
  (banda entre SL y TP con nodo del precio, sin labels redundantes) +
  stack 3-col TP/SL/Nearest (solo `%` con color contextual). Section
  header `Vigilando ahora · N` + link `Abrir el ledger →` arriba.
  `BufferCountdown` vivo (refresh cada segundo, solo visible cuando hay
  trigger cruzado en espera de buffer). `LockedCallout` dedicado para
  wallet bloqueada (antes era un span camuflado en el header). Barrido
  `vault → wallet` en strings expuestas al usuario. `StatStrip`
  retirado (3 KPIs ruidosos que duplicaban / escondían info). Nuevo
  `DashboardAlerts` con tres callouts amber contextuales — solo visibles
  cuando aplican: `BALANCE BAJO` (< 0.05 SOL), `N AUTO-EXITS EN ERROR`
  + CTA al ledger, y `N AUTO-EXITS PAUSADOS AL BLOQUEAR LA WALLET` con
  botón `REANUDAR TODOS` que itera `tasks.start` para todas las paused-
  por-sistema (heurística por `lastError` string-match). Decisión
  deliberada: NO añadir info estática al dashboard (swap-out, slippage,
  poll interval) — vive en el detalle. Sí añadir info dinámica y
  accionable (countdown buffer). Verificado en vivo el bulk-resume. Tras
  este lote, la rama acumula **30 commits**. Sin push, sin merge.
  Commits `93f9a38`, `744ef2a`, `e28cd65`.
- **Detail mockup G + iteración fina del rediseño UI (2026-05-27)**: 16
  commits sobre la rama `feature/ui-refined-dark`. Rewrite del detail
  `/tasks/[id]` siguiendo `mockups/auto-exit-detail.html` (header +
  hero con `PriceBand` + trigger cards + holdings 2×2 + details
  sidebar + activity timeline con nodos coloreados; layout 2-col
  `1fr 332px` sticky). Drop del panel "When a trigger fires"
  (redundante con onboarding + receipts). Anclar todas las páginas al
  sidebar con `mr-auto` (antes `mx-auto` dejaba ~250px de hueco
  muerto en viewports anchos). Subida de la escala tipográfica para
  perfiles mayores (body 15→17, eyebrows 11→13, etc.). Unificación
  del formato de números: 2 decimales por defecto con auto-bump si
  `<1`, separador inglés de miles (`1,234.56`), sin sufijo de moneda
  en rates del par (la denominación se ancla en el hero `1 SOL = X
  devUSDC` como hace Orca/Meteora). Lock movido del sidebar a
  `/wallet` con copy honesto sobre el trade-off (también en
  `/docs/security#hot-wallet-tradeoff`). Decisión formal en
  [ADR-039](DECISIONS.md) — el modelo hot-wallet 24/7 se acepta como
  postura por defecto; mitigation real = "treat the bot wallet as
  hot operational, never cold holdings". Sin push, sin merge.
  Commits `8da3543` a `bce3da6`.
- **Docker self-hosted server + web verificado + merge a main (2026-05-27)**:
  walkthrough end-to-end de la UI por navegador en el stack Docker —
  `/settings`, `/wallet`, `/positions` + configure, `/tasks` + detalle, `/docs`.
  Tasks de prueba creadas y borradas, `docker compose down` limpio.
  `feature/docker-web` mergeada a `main` (`92c4678`, no-ff). Formalizado
  [ADR-036](DECISIONS.md). Dos hallazgos apuntados al backlog: errores zod
  como JSON crudo en `/settings`, y `ConnectTimeoutError` a URLs públicas
  de Solana al arrancar el server. Commits `f234b9c`, `92c4678`.
- **Fixes de mensajes de error de wallet (2026-05-22)**: al importar una
  clave privada, `createKeyPairSignerFromBytes` lanzaba SolanaErrors
  crípticos que `wallet.create` no capturaba (#3704004 keypair incoherente,
  #8078012 caracteres no-base58). Ahora `vault` / `wallet` / `import` los
  traducen a mensajes accionables — el de base58 nombra los caracteres
  malos con su code point y detecta homoglifos no-ASCII (letras cirílicas
  idénticas a las latinas). Commits `254e73e`, `82aa750`.
- **Primer release público v0.1.0 (2026-05-22)**: repo abierto a público
  (`gh repo edit --visibility public`, tras `gitleaks` limpio) y release
  `v0.1.0` de la app desktop publicada en GitHub (instalador `.exe` +
  `.msi` + `latest.json` + `SHA256SUMS.txt`). El primer install-test real
  destapó dos bugs latentes — CORS (la app instalada no llegaba al
  sidecar) y navegación a rutas dinámicas (no resolvían en el export
  estático) — ambos arreglados. Nueva `docs/INSTALL.md`.
  [ADR-035](DECISIONS.md). Commits `9d32963`, `84a6de0`, `e081b6a`.
- **Auditoría de egress + updater opt-in + fix `window.confirm` (2026-05-22)**:
  auditoría de filtraciones de datos fuera del equipo — el código no
  exfiltra nada (sin telemetría/analytics, sin CDN externo, RPC siempre
  del usuario). Fixes: CSP estricta del webview, telemetría de Next off.
  El auto-check de updates pasa a opt-in (off por defecto, toggle en
  `/settings`). Fix de una regresión de F4.2.b que rompía `window.confirm`
  en Tauri (bug de `tauri-plugin-dialog` 2.7.1). [ADR-033](DECISIONS.md),
  [ADR-034](DECISIONS.md). Commits `32d9a84`, `73ea8f3`, `198e0dd`,
  `9f7b8a5`.
- **F4.2 — instalador Tauri + auto-update (2026-05-22)**:
  `tauri build` produce `.msi`/`.exe` que arrancan en la app instalada;
  la app comprueba updates al arrancar (diálogo nativo, nunca reinicia
  sin permiso). F4.2.a: `pnpm deploy --node-linker=hoisted` (node_modules
  plano y relocatable), poda de better-sqlite3, `server-app/` como
  resource de Tauri, fix del prefijo verbatim `\\?\`. F4.2.b:
  `tauri-plugin-updater` + `tauri-plugin-dialog`, keypair del maintainer,
  `docs/RELEASING.md`. [ADR-031](DECISIONS.md), [ADR-032](DECISIONS.md).
  Commits `a3344ad`, `5598343`, `2ef198d`, `4d11b10`. Sin verificar aún:
  el flujo real de un update publicado (lo prueba el primer release).
- **F4.1.b verificado — sidecar Tauri rediseñado (2026-05-22)**:
  `pnpm tauri:dev` arranca end-to-end (ventana + sidecar + server). El
  enfoque `bun --compile` de ADR-029 resultó inviable (better-sqlite3
  nativo, WASM de Orca, Meteora vía `createRequire`); el sidecar pasa a
  ser el runtime de Bun + el server desplegado con `pnpm deploy`. Driver
  SQLite dual (bun:sqlite / better-sqlite3). [ADR-031](DECISIONS.md).
  Commits `437b1cf`, `efe9ac3`, `ae278f5`.
- **Pre-public infra (2026-05-21)**: `.github/workflows/ci.yml` con typecheck
  + tests + gitleaks-action; issue templates + PR template + `CONTRIBUTING.md`;
  `.gitleaksignore` con 4 fingerprints documentados; `attribution.commit = ""`
  en settings local para no añadir trailer en futuros commits; history
  rewrite con `git filter-repo` para purgar archivos internos de los
  commits anteriores y limpiar trailers `Co-Authored-By: Claude` (force-
  push). Repo ready para `gh repo edit --visibility public` cuando se
  decida.
- **B-02 fix (2026-05-21)**: `tasks.create` rechaza `network` + `rpcUrl`
  incoherentes (mainnet + api.devnet.solana.com). Helper testeable
  `inferNetworkFromRpcUrl` en `security/rpc-url.ts` con política conservadora
  (RPCs privados → `null` → no se bloquean). 7 tests nuevos.
- **Vitest scaffold + 53 tests baseline (2026-05-21)** ([ADR-028](DECISIONS.md)):
  primera ronda de tests del repo. 5 suites cubriendo `security/rpc-url`
  (14 tests), `security/unlock-limiter` (7), `tasks/buffer` (11),
  `tasks/verify` (8), `tasks/manager.markError` (5+ integration). Bugs
  reales encontrados durante la escritura (IPv6 brackets en `assertSafeRpcUrl`).
  CI workflow ya corre `pnpm test` automáticamente.
- **QA audit fixes (2026-05-21)**: aplicados los Top 6 hallazgos críticos
  del code review combinado. B-01 (mark* guards), B-03 (fetch timeouts en
  verify + wallet.balance), B-06 (evalBuffer extraído a módulo puro),
  H-01 (try/catch en tasks.pause + tasks.delete), H-02 (assertSafeRpcUrl
  rechaza credenciales embebidas), H-04 (pollMs.max en tasks.create).
  El resto queda explicitado en backlog arriba.
- **Security hardening (2026-05-21)** ([SECURITY.md](../SECURITY.md)):
  nuevo `security/rpc-url.ts` con `assertSafeRpcUrl` (SSRF guard:
  bloquea loopback default, cloud metadata 169.254/16, all-interfaces,
  IPv6 link-local; mantiene LAN privadas + Tailscale CGNAT permitidos).
  Nuevo `security/unlock-limiter.ts` (5 intentos / 5 min ventana
  deslizante). Aplicados en `settings.update`, `tasks.create`,
  `wallet.unlock`. SECURITY.md ampliado con threat table actualizada
  + pre-public checklist con `gitleaks`.
- **Bug fixes /tasks/[id] (2026-05-21)**: SolscanLink hardcodeaba
  `?cluster=devnet` → 404 en mainnet. Propagado `network` a CloseReceipt
  / SwapReceipt / ActivityTimeline / EventRow. Race condition pause/abort:
  `if (signal.aborted) return` antes de `markTriggered` y antes del swap
  opcional.
- **Legal disclaimer + /docs coherencia + i18n drift (2026-05-21)**:
  `README.md` sección "use at your own risk", nuevo `/docs/disclaimer`
  artículo #07, links contextuales desde 4 puntos del UI. Revisión de
  los 6 artículos /docs existentes para reflejar Meteora hecho,
  simulación retirada, time buffer, mainnet default. Limpieza de drift
  EN/ES (`threshold cruzado` → `Umbral`, `buffer cronómetro reset` →
  `buffer timer reset`).
- **i18n EN/ES + LangProvider + modal scroll (2026-05-21)**: sistema
  de internacionalización casero (`packages/web/src/i18n/`) con
  `LangProvider` + `useT()` + localStorage persist + `navigator.language`
  detection. Toggle EN/ES en header. Fix: LangProvider debe envolver
  Providers (no al revés) porque ConnectWalletModal se renderiza global.
  Modal de connect-wallet con scroll cuando overflow.
- **UX iterativo /tasks (2026-05-21)**: position name (SOL / devUSDC)
  en lista, PoolState section en detail (rango, holdings, fees pending
  cada 10s), dual distances TP+SL (en lugar de un único nearest), range
  + in/out dot en home y list rows para discriminar pool trading.
- **F6.3.b — reset fix + test pill + network preservation (2026-05-21)**:
  Reset to defaults imperativo (TanStack structural sharing impedía el
  useEffect). `factoryDefaults` en snapshot tRPC. Reset preserva la fila
  `network`. Pill "test mode" amber en devnet (no en mainnet).
- **F4.1.b — Tauri sidecar + static export + iconos (2026-05-21)**:
  - Next.js: `output: 'export'` activado por env `TAURI_BUILD=1`; rutas
    dinámicas `[mint]` y `[id]` refactorizadas a `page.tsx` Server
    Component (con `generateStaticParams` placeholder + `dynamicParams
    = false`) + `client.tsx` con la lógica actual. Build de export
    funciona, ver `packages/web/out/`.
  - Server: nuevo `scripts/build-binary.ts` que invoca `bun build
    --compile` con el target triple del host; output a
    `packages/tauri/binaries/auto-exit-server-<triple>[.exe]` +
    copia de `drizzle/` para que Tauri lo bundlee como resource.
    Falta verificar el binary real (requiere Bun instalado).
  - Tauri: `lib.rs` con `setup()` que spawn el sidecar via
    `tauri-plugin-shell`, le pasa `DB_PATH`, `WALLET_VAULT_PATH`,
    `DRIZZLE_MIGRATIONS` resueltos por `app.path()`, y registra
    `RunEvent::Exit` para matarlo al cerrar. Capabilities/permissions
    en `capabilities/default.json`. `tauri.conf.json` con
    `externalBin` + `resources`.
  - Iconos: PNG fuente 1024×1024 generado con Python+PIL (letra "A"
    terracota sobre crema, estilo brand); set completo (PNG, ICO,
    ICNS, iOS, Android) generado con `pnpm exec tauri icon`.
  - Scripts raíz: `build:web-export`, `build:server-binary`,
    `build:tauri-prep` (el último se ejecuta automáticamente como
    `beforeBuildCommand` en `tauri.conf.json`).
- **F4.1.a — Tauri scaffolding (2026-05-21)**: `packages/tauri/` con
  manifest Rust + `tauri.conf.json` v2 + entry points + scripts. `pnpm
  tauri:dev` listo para abrir ventana nativa cuando el usuario instale
  Rust + VS Build Tools. Ejecuta [ADR-015](DECISIONS.md). Pendientes:
  F4.1.b (sidecar + static export + iconos) y F4.2 (builds unsigned +
  auto-update con keypair propia).
- **F6.3 — Meteora `swapToExit` (2026-05-21)**: swap quote vía
  `dlmm.swapQuote(...)`, real path vía `dlmm.swap({...})` con `Keypair`
  de web3.js v1. Sección "Output token" del ConfigureForm reactivada para
  Meteora. Validado dry-run contra mainnet en ambas direcciones
  (SOL↔USDC). **F6 cerrada al 100%**: paridad funcional con Orca.
- **F6.2 — Meteora `closePosition` + UI integration (2026-05-21)**:
  - F6.2.a dry-run: lee `positionData` y devuelve quote sin firmar.
  - F6.2.b real: `WalletVault.getRawSecret()` expone los 64 bytes;
    contracto `attachWallet(signer, rawSecret?)`; `MeteoraAdapter`
    construye `Keypair` de web3.js v1 y llama
    `dlmm.removeLiquidity({ shouldClaimAndClose: true })`.
  - F6.2.c UI: elimina `ReadOnlyProtocolNotice`, `ConfigureForm` acepta
    `posRef` y construye `protocolConfig` por rama. Aplicación directa
    de [ADR-024](DECISIONS.md).
- **F6.1 — Meteora DLMM adapter read-only + UI aggregation (2026-05-21)**:
  primer adapter no-Orca. `listOwnedPositions`/`getPositionSummary`/`getPrice`
  via `@meteora-ag/dlmm`. UI agrega los dos protocolos en paralelo en
  `/positions` y `/positions/[mint]`. Meteora read-only via
  `ReadOnlyProtocolNotice` hasta F6.2. Coexistencia de SDKs y workaround
  ESM/CJS de anchor en [ADR-024](DECISIONS.md). Validado contra mainnet
  con probe y posición real.
- **F4.3 — Mainnet UI gate (2026-05-21)**: `ALLOW_MAINNET_LIVE=true` como
  permiso meta del server + confirmación explícita en dos pasos en
  `/settings`. `tasks.create` rechaza mainnet sin el gate (doble red).
  Píldora oxblood prominente en GlobalHeader cuando network=mainnet.
- **F4.0 — Prep del repo para apertura (2026-05-21)**: LICENSE MIT,
  SECURITY.md con threat model + reporting, README reescrito en inglés
  alineado con estado F0-F3. Repo apto para `gh repo edit --visibility public`.
- **F3 — Settings page + onboarding amable (2026-05-21)**: settings router
  con get/update/reset, página `/settings` editorial con form unificado,
  wire de defaults en el configure form y `/positions`, AddressBlock con
  QR + faucet link + balance live polling en el success screen del modal
  post-Generate. Decisión en [ADR-023](DECISIONS.md).
- **F2 — On-chain verification + actual vs quoted + persisted mints
  (2026-05-21)**: history endpoint + timeline editorial en `/tasks/[id]`,
  `verifyTxBalances` parsea `getTransaction` para computar deltas reales
  de la bot wallet, evento `verified` se renderiza como ActualLine en
  CloseReceipt/SwapReceipt con diff % coloreado, `tokenMintA/B`
  persistidos en `protocolConfig` para eliminar la heurística SOL/devUSDC.
  Decisión en [ADR-022](DECISIONS.md).
- **Onboarding redesign (2026-05-21)**: home first-run pedagógico, modal
  con tres caminos honestos + warning técnico corregido (blast radius =
  address concreta), empty states con explicación de cómo meter posiciones
  en la bot wallet, `/docs` in-app con 6 artículos editoriales, links
  contextuales sembrados por la UI. Decisión en [ADR-021](DECISIONS.md).
- **F1 cerrada al 100%** (F1.1 a F1.6): scaffolding Next.js + tRPC client +
  CORS + pantallas /wallet, /positions, /positions/[mint]/configure,
  /tasks, /tasks/[id].
- **UI redesign R1–R8**: foundations editoriales, lenguaje (token registry +
  status mapper), home dashboard, wallet UX, positions+configure fusionadas,
  task dashboard, ledger /tasks, pulido (not-found, error boundary, mobile,
  fade-in).
- **UI tweaks v1 + v2**: logo expandido, VAULT→WALLET en copy, column headers,
  history rename, auto-exit verb, one-watcher-per-position rule.
- **Take-profit + Stop-loss simultáneos**: schema, watcher dual-check, tRPC
  refine, UI con dos TriggerInput, displays con formatTriggers + formatNearestDistance.
- **Connect-wallet modal Orca-style**: server-side keypair generation,
  ConnectWalletProvider, modal con 3 tabs, success view con secret revealable
  + checkbox obligatorio.
