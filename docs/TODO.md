# TODO

## En curso

(nada activo)

## Próximo (orden sugerido)

- [ ] **F5** — LAN access opcional (token de pareja) + service-of-OS sidecar
  (launchd / systemd / Windows Service) para 24/7 sin Tauri abierto.
  Notificaciones Telegram opcional.

## Backlog (sin orden)

- [ ] Estudiar soporte para más protocolos de LP: **Raydium** (CLMM/CPMM) y
  **Kamino** (Liquidity / vaults). Hoy hay 2 adapters (Orca, Meteora DLMM)
  detrás de la interfaz `ProtocolAdapter` (`listOwnedPositions` /
  `getPositionSummary` / `getPrice` / `closePosition` / `swapToExit`), así
  que añadir uno es: nuevo adapter en `packages/engine/src/protocols/<x>/`,
  registrarlo en `protocols/registry.ts` (`makeAdapter` + `REGISTERED_PROTOCOLS`)
  y en `packages/web/src/lib/constants.ts` (`PROTOCOLS` + `PROTOCOL_LABELS`),
  y la UI ya lo agrega en paralelo. A evaluar por protocolo antes de
  comprometerse:
  - Calidad/madurez del SDK TS y si su discovery usa `getProgramAccounts`
    (como Meteora — exige RPC con gPA filtrado, p.ej. Helius; ver más abajo
    el incidente del 2026-05-29) o `getTokenAccountsByOwner` (como Orca,
    universal). Documentar el requisito de RPC por protocolo.
  - Compatibilidad de SDK con la coexistencia actual web3.js v1 (Meteora) +
    @solana/kit (Orca); aislar en el adapter como en [ADR-024](DECISIONS.md).
  - Kamino: confirmar que el modelo (vaults / posiciones gestionadas) encaja
    con el contrato actual de "cerrar una posición concreta del owner"; sus
    vaults autogestionados pueden no mapear 1:1 a `closePosition`.
  - Raydium CLMM: posiciones NFT-based como Orca → discovery probablemente
    vía `getTokenAccountsByOwner` (buen encaje). Verificar el flujo de
    remove-liquidity + claim + swap de salida.
  Decisión pendiente: ¿merece la pena el coste de mantenimiento de cada SDK
  vs. la demanda real? Priorizar según qué protocolos usan Pedro y su círculo.
- [ ] Traducir a español las páginas `/docs` del frontoffice (in-app).
  **Importante / corrección**: el copy de los artículos de `/docs` NO está
  i18n-izado — está hardcoded en inglés en los TSX
  (`packages/web/src/app/docs/{slug}/page.tsx` + `_components/articles.ts`),
  sin pasar por `useT()`. (El resto de la UI — settings, dashboard, forms —
  sí es bilingüe; los artículos largos de docs se quedaron fuera). Incoherencia
  visible: con la app en español, `/docs` aparece en inglés. Dos enfoques
  evaluados (2026-05-29):
  - **Componente por idioma**: cada `page.tsx` elige variante EN/ES según el
    lang activo. Preserva el JSX inline, cero refactor de infra, rápido. Coste:
    duplica el JSX por artículo + sincronización manual.
  - **Migrar a Markdown/MDX** (cierra de paso el item de abajo "migrar /docs a
    markdown single-source"): `faq.en.md`/`faq.es.md` renderizados con
    react-markdown/MDX. Más limpio para prosa larga y reusable desde GitHub.
    Coste: refactor de loader + sidebar + routing ANTES de traducir nada.
  NO meter la prosa en `en.ts`/`es.ts` como funciones-string: son ~3000
  palabras con markup inline (links, `<code>`, `<em>`), partirlo en claves es
  insufrible y frágil. Decisión aplazada: features (Raydium/Kamino) primero.
- [ ] Documentación en español de los docs del repo (GitHub, NO frontoffice).
  `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/INSTALL.md`,
  `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/RELEASING.md`,
  `docs/SECURITY-AUDIT.md`, `docs/TESTING.md`, `docs/TODO.md` están
  en inglés. Un usuario hispanohablante que aterriza en el repo se topa
  con instalación / seguridad / arquitectura en inglés. Plan razonable
  cuando se aborde:
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
- [ ] (Opcional) Cargar la Jupiter token list en background para cubrir mints
  arbitrarios sin hardcodear — trade-off con la política "no external assets"
  del threat model. El registry hardcoded ya cubre los tokens comunes
  (ampliado 2026-05-29, ver abajo); esto solo haría falta si aparecen muchos
  pares con tokens fuera de la lista.
- [ ] Cierre + swap atómico en una sola tx (combinar `closePositionInstructions`
  + `swapInstructions` + `buildAndSendTransaction` de `@orca-so/tx-sender`).
  Elimina el riesgo de slippage entre las dos tx.
- [ ] Anti-flapping: confirmar el trigger durante N ciclos antes de cerrar.
- [ ] `EXIT_TOKEN_MINT` con tokens FUERA del pool (vía Jupiter en mainnet,
  multi-hop). Hoy solo mismo pool (ADR-008).
- [ ] Ampliar cobertura de tests (baseline actual: 169 con Vitest). Las
  prioridades 1–3 (vault cripto, módulos puros del engine, lifecycle de
  TaskManager) se cerraron el 2026-05-29. Pendientes priorizados:
  adapters Orca + Meteora con SDK mocks (el más delicado: los SDKs no
  exponen interfaces limpias y los golden fixtures envejecen), routers
  tRPC vía `appRouter.createCaller(ctx)` con DB en memoria (validaciones
  zod de `tasks.create`, gate de mainnet, unlock-limiter e2e, endpoints
  nuevos `meta.dbSize` / `tasks.listHistorical`), y `executeClose` del
  watcher con un adapter fake (close→verify→swap→done + ramas de error).
  Detalle en [TESTING.md](TESTING.md).
- [ ] Auto-lock del wallet por inactividad (configurable; default 30 min sin
  operaciones). Hoy no hay timeout.
- [ ] Cifrado opcional del SQLite del server (SQLCipher) para entornos donde
  el disco no esté full-disk-encrypted.
- [ ] Manejo explícito de buffer de fees al swapear SOL nativo (hoy delegamos
  al `nativeMintWrappingStrategy` del SDK).
- [ ] Métricas / observabilidad: logs estructurados (JSON), opción de
  exportar a fichero rotado o Prometheus.
- [ ] Reportar upstream el bug de `tauri-plugin-dialog` 2.7.1: su
  `init-iife.js` sobrescribe `window.confirm` para invocar el comando
  `plugin:dialog|confirm`, que esa versión ya no registra. Mitigado en
  local con `confirm_fix_plugin` ([ADR-034](DECISIONS.md)); si upstream
  lo arregla, retirar el workaround.
- [ ] Empaquetar la app desktop para macOS y Linux. El release v0.1.0 es
  solo Windows — `tauri build` no hace cross-compile del instalador, así
  que requiere buildear en cada SO (o un CI con runners macOS/Linux).

## Hecho recientemente

Para el detalle de cada cambio, consultar `git log` y los commits referenciados.

- **Hardening de seguridad: SSRF en discovery + permiso Tauri + doc (2026-05-30)**:
  pase tras una auditoría externa. (1) `positions.listOwned`/`getSummary`
  pasaban el `rpcUrl` del cliente a `setupRpc` sin `assertSafeRpcUrl` —
  único hueco SSRF (las otras 3 rutas ya lo aplicaban) y alcanzable sin vault
  unlocked; ahora corren el guard como primera línea (`BAD_REQUEST` antes de
  abrir conexión) + nuevo `positions.test.ts` (6 tests). (2) Quitado el permiso
  `shell:allow-execute` de `capabilities/default.json` — superficie muerta: el
  frontend no usa shell y el sidecar lo spawnea Rust en `setup()`. (3) Corregido
  el comentario opt-IN obsoleto de `ALLOW_MAINNET_LIVE` en `.env.example` a la
  semántica opt-OUT real (ADR-026). Hallazgos de auth-sin-token y supply-chain
  de la auditoría = trade-offs de diseño ya documentados, sin cambio.
- **Bug de discovery RPC (QuickNode) + guards (2026-05-29)** ([ADR-043](DECISIONS.md)):
  un usuario en v0.3.1 con QuickNode no encontraba ningún pool (sin error);
  causa = QuickNode restringe `getProgramAccounts` (el método que usa el
  discovery de Meteora) devolviendo `[]` con HTTP 200. Fix: `settings.get`
  expone `rpcNetworkMismatch` (vía `inferNetworkFromRpcUrl`) y el dashboard
  avisa cuando el host del RPC parece de otra red que la activa;
  `positions.listOwned` decora errores de Meteora que huelen a gPA restringido;
  Settings + empty-state recomiendan fuerte un endpoint gratuito de Helius
  (sin key embebida — el repo es público). Confirmado por el usuario: con
  Helius ve todos los pools. Commits `955ffb5`, `73b41c0`.
- **Token registry ampliado + test de invariantes (2026-05-29)**: añadidos 10
  mints mainnet verificados de fuente fiable (CoinGecko/Solscan/Jupiter):
  PYUSD, JLP, jupSOL, INF, JTO, PYTH (tokens/LSTs) + USDe, USDS, EURC, USDY
  (stablecoins top de Solana por circulación, vía DefiLlama). Decimals
  verificados uno a uno — **USDe es 9 decimals**, no 6 como las demás stables;
  asumirlo habría mostrado cantidades 1000× mal. Nuevo `tokens.test.ts` (8
  tests, primer test del paquete web) con invariantes: mints/símbolos únicos,
  longitud base58 plausible (32-44, sin `0OIl`), decimals 0-18, y lookups
  (`tokenSymbol`/`tokenMeta`/`isKnownToken`). Protege contra copy-paste de un
  mint duplicado/mal en una app de dinero real. typecheck + 163 tests verde.

- **Diff threshold del receipt configurable (2026-05-29)**: el umbral antes
  hardcoded (`|diff| < 0.01%` en `ActualLine`) pasa a `/settings` como
  `diffWarningThresholdBps` (key SQLite `diff_warning_threshold_bps`), default
  1 bps (= 0.01%, preserva el comportamiento). Mismo patrón que
  `lowBalanceThreshold`: campo en el snapshot + factoryDefaults, zod
  `min(0).max(10_000)`, input en % en /settings (helpers `bpsToPctString`/
  `pctStringToBps`), `ActualLine` lee el snapshot vía `trpc.settings.get`.
  typecheck + 155 tests verde.

- **Release v0.3.1 + fix NSIS del sidecar (2026-05-29)**: el auto-update real
  `v0.2.0 → v0.3.0` falló igual ("Error opening file for writing") — esperado:
  el fix de Rust de v0.3.0 corre en la app que actualiza (la vieja), y v0.2.0
  predata el fix. Fix robusto: preinstall hook de NSIS
  (`packages/tauri/nsis-hooks.nsh` vía `bundle.windows.nsis.installerHooks`)
  que hace `taskkill /F /T /IM auto-exit-server.exe` al instalar. Viaja en el
  instalador nuevo → protege el update venga de la versión vieja que venga.
  v0.3.1 publicada con el hook; build OK (makensis corrió con el hook sin
  error), `/latest/download/latest.json` sirve 0.3.1. Commits `2f093ff` (fix)
  + `d4485cf` (release). Docs corregidos: el framing previo de "v0.2.0→v0.3.0
  verifica el fix" era erróneo. **VERIFICADO**: el auto-update real
  `v0.3.0 → v0.3.1` con opt-in completó sin error → **P0 del sidecar zombie
  cerrado en producción** (lo ejercitaron a la vez el kill de Rust de v0.3.0 y
  el hook NSIS de v0.3.1).
- **Release v0.3.0 publicado (2026-05-29)**: bump minor (features desde
  v0.2.0: resume seguro + validación 1-auto-exit-por-posición, no solo el
  patch del sidecar). Build firmado OK (la poda de `*.test.ts` funcionó:
  8 ficheros podados del sidecar), install-test pasado, `latest.json` +
  `SHA256SUMS.txt` generados, `main` pusheado, Release creada con los 4
  assets. `/releases/latest/download/latest.json` → 200. Commit `1ad2c70`
  + tag `v0.3.0`. URL:
  https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases/tag/v0.3.0
- **Cluster de deuda técnica (2026-05-29)**: dos items del backlog. (1)
  `build-binary.ts` poda ahora recursivamente los `*.test.ts`/`*.spec.ts` del
  `src/` desplegado en `server-app/` (acotado a src/, nunca node_modules) —
  eran 11 ficheros de test como peso muerto en el instalador. (2) `probe-e2e.ts`
  pasaba un array de args con `shell:true` (combo que dispara DEP0190);
  cambiado a comando string único (`pnpm start:server`), mismo patrón que el
  `run()` de build-binary. Walk de pruning verificado contra árbol temporal.
  Commit `6196410` + este (docs).
- **Validación backend "1 auto-exit por posición" (2026-05-29)**: la regla
  solo se aplicaba en UI (el configure muestra ExistingWatcher en vez del
  form); un cliente tRPC que se la saltara podía crear N watchers para la
  misma posición. `TaskManager.createTask` comprueba ahora si ya hay una task
  ocupante (estados no-terminales idle/armed/triggered/closing/paused — espejo
  exacto del UI; done/error/stopped no ocupan) antes de insertar, y lanza
  `DuplicateActiveTaskError` (tipada) que el router mapea a `409 CONFLICT`.
  Check + insert síncronos en server single-threaded → atómico, sin race.
  +11 tests (143 → 154). Commit `717e01b` + este (docs).
- **Resume seguro tras desbloquear (2026-05-29)**: el callout "reanudar
  todos" reanudaba todas las tasks pausadas-al-bloquear sin mirar si su
  precio cruzó el trigger durante el lockdown — un resume podía disparar un
  cierre inmediato no elegido. Ahora el server (`tasks.resumeCandidates`)
  lee el precio actual de cada candidata (mismo camino que el watcher) y el
  dashboard parte el callout en "reanudables sin riesgo" (precio leído y NO
  cruzó → bulk-resume) vs "cruzaron su trigger — revisa" (lista con link por
  task). Invariante: solo "seguro" con precio real y sin cruce; nulo/cruzado
  → revisar. Markers de pausa-por-sistema centralizados en `tasks/resume.ts`
  (antes duplicados como literales en manager.ts y cliente). Helper puro
  `evaluateTriggerCross` testeado + `evaluateResumeCandidates` sin red. +13
  tests (130 → 143). Commit `4afcb1c` + este (docs).
- **Sprint de cobertura de tests (2026-05-29)**: cerradas las prioridades
  1–3 del backlog de tests (55 → 130, +75). (1) `vault.test.ts`: roundtrip
  cripto create/unlock + clasificación B-09 (`WrongPassphraseError` vs
  `VaultCorruptedError`, con forge de un vault cuyo tag GCM valida pero el
  contenido es inválido) + validación de inputs + copia de `getRawSecret`
  + lock/delete. (2) `retry.test.ts` + `loop.test.ts` + `env.test.ts`:
  módulos puros del engine (`isPermanentSolanaError`, `withRetry` con
  backoff, control flow del loop, `loadBaseConfig` + gate de mainnet).
  (3) `manager.lifecycle.test.ts`: `boot()` re-pausa activos, no toca
  terminales; `pauseAllOnVaultLock`; atomicidad B-04 (rollback en
  `createTask`); cascada FK de history; `deleteAllTasks`; paginación
  cursor + counts. Sin cambios en código de producción. typecheck verde.
  Commit `f8cca18` (tests) + este (docs).
- **Cluster performance + data hygiene (2026-05-29)**: 3 items
  dejando /tasks listo para uso sostenido. (1) Health check del
  tamaño SQLite: nuevo router `meta` con `dbSize`, threshold 50 MB
  (uso normal <2 MB/año), callout amber en el dashboard cuando se
  supera. (2) Meteora `getPositionSummary` pasa de O(N) a O(1):
  reemplazado el path
  `DLMM.getAllLbPairPositionsByUser(owner)` (que recorre todas las
  posiciones DLMM del owner) por `dlmm.getPosition(positionPk)` que
  decodea solo la pedida. (3) Paginación server-side del histórico de
  `/tasks`: nuevos endpoints `tasks.listHistorical({ limit, cursor,
  filter })` cursor-based + `tasks.historicalCounts` para los tabs.
  Frontend con `useInfiniteQuery` + botón "Load more"; PAGE_SIZE=50.
  El dashboard sigue usando `tasks.list` (orthogonal). Commits
  `3734f5a` (health check), `3044a08` (Meteora perf), `055fd84`
  (paginación), + este (docs).
- **QA audit cerrado — 6 fixes round 2 (2026-05-29)**: los 6 hallazgos
  restantes del audit aplicados, cerrando el bloque. (B-14)
  `assertMigrationsReady` lanza con mensaje accionable en lugar de
  warn + arranque silencioso. (B-15) `parseIntOr` clampa fuera de
  rango (default `[0, MAX_SAFE_INTEGER]`). (B-17) `ALLOW_LOOPBACK_RPC`
  acepta `true|1|yes|on` (case-insensitive), mismo set que el
  `parseBool` del engine; unknown values siguen bloqueando.
  (B-09) `WrongPassphraseError` + `VaultCorruptedError` exportadas
  en vault.ts; el unlock-limiter solo cuenta el primer tipo. (B-08)
  Botón Lock en /wallet deshabilitado cuando hay tasks en `closing`
  (derivado de `tasks.list` cacheado, sin endpoint nuevo); tooltip
  explica que lockear no cancela la tx, solo evita registrar el
  receipt. (B-11) Meteora `closePosition` trackea `successfulSigs[]`
  y lanza error explícito cuando una tx[N] falla tras N-1 éxitos —
  el receipt ya no miente con "closed cleanly" en cierres parciales.
  Commits `58457c8` (B-14), `d01d281` (B-15), `77ff6bd` (B-17),
  `527194e` (B-09), `e77fbd8` (B-08), `dc6fda4` (B-11).
- **QA audit hardening — 5 fixes top-impact (2026-05-29)**: cluster
  de correctness fixes del backlog acumulado. (B-04) atomicidad de
  los 9 pares `update tasks` + `appendHistory` con `db.transaction`
  + parámetro opcional `tx` en `appendHistory` para que respete la
  transacción del caller. (B-05) `withRetry` acepta predicado
  `retryableErrors`; helper `isPermanentSolanaError` exportado
  (heurística por keyword: slippage, insufficient, invalid mint/
  pool/position, account not found). Callsites de close + swap
  (manager + runner) actualizados. (B-07) `WalletVault.getRawSecret`
  devuelve `new Uint8Array(secret)` — evita mutación por consumidor
  y race con `lock()`. (B-10) `verifyTxBalances` usa nuevo helper
  `allKeys(tx)` que concatena accountKeys + loadedAddresses.writable
  + readonly en orden global; 2 tests nuevos cubren writable y
  readonly (suite 53→55 tests). (B-20) catch del spawn del watcher
  llama `markError` para que la task pase a `error` cuando el loop
  crashea, en lugar de quedar en `armed` muerta. Commits `fc478c2`,
  `c175b8b`, `0f6c966`. 6 items QA audit pendientes para próxima
  sesión (B-08, B-09, B-11, B-14, B-15, B-17).
- **Fix P0 del sidecar zombie + bump a 0.2.1-dev (2026-05-29)**: arreglado
  el bug descubierto durante la verificación de v0.2.0. Hook al callback
  `on_download_finish` de `download_and_install` en `packages/tauri/src/
  lib.rs` que mata el sidecar después de la descarga y antes de que el
  installer NSIS arranque — momento mínimo de exposición a "sin sidecar".
  Si la instalación falla luego, el siguiente arranque respawnea el
  sidecar normalmente. `cargo check` OK. Bump de los 6 manifests a
  `0.2.1-dev` para reflejar que `main` es ya el pre-release path a
  `v0.2.1`. Entrada al CHANGELOG `[Unreleased] → Fixed`. Commits
  `ae706fc` (fix) + este (bump + docs).
- **Release `v0.2.0` publicado + auto-update verificado (2026-05-29)**:
  release firmado con la keypair del updater (`pnpm tauri:release`),
  `.exe` + `.msi` + ambos `.sig` + `latest.json` + `SHA256SUMS.txt`
  subidos al GitHub Release. Push de `main` + tag `v0.2.0` a remoto.
  Install-test del NSIS en local: la app arranca, sidebar muestra
  `v0.2.0`, sidecar conecta, wallet desbloquea, balance polling, Test
  RPC button, navegación a todas las páginas — todo OK. Verificado el
  flujo end-to-end de auto-update desde una instalación previa de
  `v0.1.1` (toggle opt-in activado, reinicio, plugin pinga GitHub,
  diálogo nativo, descarga + verify firma + lanzamiento del NSIS),
  pero apareció el bug del sidecar zombie — apuntado como P0 arriba.
  Commit del release: `5f2db72`. URL:
  https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases/tag/v0.2.0
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
