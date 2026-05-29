# Testing

## Estado actual

**Baseline de 55 tests automatizados con Vitest** (cubriendo seguridad, lifecycle del watcher, verificación on-chain con LUTs) + typecheck en CI + smoke tests manuales en devnet/mainnet.

1. **Typecheck**: `pnpm typecheck` (= `tsc --noEmit` raíz + web). Verde.
2. **Tests automatizados**: `pnpm test` (Vitest, ~1.8s, 55/55 verde). Ver [Tests automatizados](#tests-automatizados) abajo.
3. **Secret scan**: `gitleaks` en CI vía GitHub Action `gitleaks/gitleaks-action@v2`.
4. **Smoke tests manuales** en devnet (Orca) y mainnet (Orca + Meteora) — documentados abajo desde F0.

Cobertura aún parcial — ver [backlog](TODO.md) para áreas no cubiertas (vault cripto, adapters Orca/Meteora con SDK mocks, lifecycle completo de TaskManager, routers tRPC). El **QA audit del 2026-05-29** cerró los 11 hallazgos B-XX originales (algunos añadieron tests, otros eran fixes localizados sin test) — ver [PROGRESS.md](PROGRESS.md) para el detalle.

## Tests automatizados

Stack: **Vitest 4** ([ADR-028](DECISIONS.md)). Config en `vitest.config.ts` raíz — include `packages/*/src/**/*.{test,spec}.ts`, environment node, testTimeout 10s.

```bash
pnpm test            # corre una vez
pnpm test:watch      # re-corre al guardar
pnpm test:coverage   # genera coverage v8 (HTML + text)
```

### Suites actuales (55 tests · ~1.8s)

| Suite | Tests | Cubre |
|---|---:|---|
| `packages/server/src/security/rpc-url.test.ts` | 14 | URL invalid, schemes no-http(s), credenciales embebidas, loopback default + escape hatch con keywords truthy (B-17 ampliado a `true\|1\|yes\|on`), metadata cloud, all-interfaces, IPv6 link-local, LAN privadas permitidas, Tailscale CGNAT, RPCs públicos, case-insensitive, ws(s). Más 7 casos sobre `inferNetworkFromRpcUrl` (B-02). |
| `packages/server/src/security/unlock-limiter.test.ts` | 7 | Sliding window 5 intentos/5min, bloqueo al sexto, expiración por ventana, reset al unlock exitoso, mensaje con segundos restantes, prune parcial. |
| `packages/server/src/tasks/buffer.test.ts` | 11 | Máquina de estados del time-buffer (ADR-025) — in/out × buffer 0/positivo/negativo × current null/vivo + secuencia arm→reset→re-arm + TP/SL independientes. |
| `packages/server/src/tasks/verify.test.ts` | 10 | Parsing happy-path de solDelta + tokenDeltas (con exclusión de cuentas no-owned), **owner via `loadedAddresses.writable` (B-10)**, **owner via `loadedAddresses.readonly` (B-10)**, error paths (meta null, tx fallida on-chain, indexer lento), retry exitoso + retry agotado, AbortSignal pasado al fetch en cada attempt. Fake timers para evitar esperar backoffs reales. |
| `packages/server/src/tasks/manager.markError.test.ts` | 5+ | Integration test con sqlite `:memory:` + migrations reales — cubre B-01 (mark* respetan estados decididos por usuario). |

### Bugs reales descubiertos por los tests

- **`assertSafeRpcUrl` no normalizaba corchetes IPv6** que Node 22 deja en `url.hostname` (`[::1]` en vez de `::1`). `http://[::]:7777` y `http://[fe80::1]` PASABAN la validación silenciosamente. Fix con `stripIPv6Brackets`.
- **`vi.fn().mockResolvedValue(rpcResponse(null))`** reusaba la misma `Response` cuyo body solo puede consumirse una vez. Fix con `mockImplementation(async () => rpcResponse(null))`.
- **B-10 (LUTs silentes en `verifyTxBalances`)** — descubierto por revisión QA, no por test, pero formalizado con dos tests nuevos al cerrar el audit. `keyAt` solo miraba `accountKeys`; si la bot wallet estaba SOLO en `meta.loadedAddresses.writable`, el index real era `accountKeys.length + i` y `solDelta` quedaba en 0 silenciosamente — el receipt mentía con "cerró sin mover SOL" mientras la tx sí movía SOL real. Los dos tests nuevos (`finds the owner via loadedAddresses.writable` + `... .readonly`) previenen regresiones.

### Bugs reales descubiertos en producción

Cosas que NO descubrieron los tests pero sí la operación real:

- **Sidecar zombie en auto-update (2026-05-29)** — descubierto al verificar el flujo end-to-end del primer update real (`v0.1.1 → v0.2.0` con opt-in activado). El plugin `tauri-plugin-updater` dispara correctamente toda la cadena (check, diálogo, descarga, verify firma) pero el shell Tauri sale por un path que se salta el `RunEvent::Exit` donde matamos al sidecar — `auto-exit-server.exe` sigue vivo bloqueando el `.exe` que NSIS intenta sobrescribir. Fix en `packages/tauri/src/lib.rs` (hook al `on_download_finish` que mata el sidecar antes del install). El fix viaja dentro de v0.2.0+; el siguiente update real `v0.2.0 → v0.2.x` lo verificará. Lección: el smoke test del flujo de auto-update **debe** correrse contra dos versiones reales publicadas, no se sustituye por unit test.

### Reglas de mocking

- **Aceptable mockear**: `fetch` global (`vi.stubGlobal`), tiempo (`vi.useFakeTimers()`), env vars (`vi.stubEnv`).
- **No mockear**: `node:crypto` (los tests del vault usan scrypt real, ~50-100ms/unlock — aceptable). SQLite (in-memory real con migrations reales).
- **Métodos privados de `TaskManager`**: acceso vía cast `(mgr as unknown as { method: ... }).method(...)`. Pragmático para tests sin convertir los métodos a `protected`.

### Pendiente de cubrir (priorizado)

1. `wallet/vault.ts` — roundtrip create/unlock + bad passphrase distinguible de tamper (B-09 si lo implementamos).
2. `engine/core/{retry,loop}.ts` + `engine/config/env.ts` — pure functions, fáciles.
3. Lifecycle completo de `TaskManager` — `boot()` re-pausa stale states, `pauseAllOnVaultLock`, transiciones atómicas (DB write + appendHistory en transaction, B-04).
4. Adapters Orca + Meteora con SDK mocks — cuando se decida el approach del mock (golden fixtures vs interfaces stub).
5. Routers tRPC con `appRouter.createCaller(ctx)` — integration tests con DB en memoria.

## CI

GitHub Actions: `.github/workflows/ci.yml`. En cada push/PR a `main`:

| Job | Pasos | Duración típica |
|---|---|---:|
| `test` | pnpm install → typecheck (root + web + server + engine + cli) → vitest | ~1m |
| `sidecar-smoke` | setup Bun → pnpm install → arranca el server bajo Bun y comprueba que responde (ejercita el driver `bun:sqlite` — ADR-031) | ~1m |
| `secret-scan` | checkout full history → gitleaks-action | ~10s |

Cancelación concurrente: runs previos del mismo branch/PR se cancelan al llegar uno nuevo.

`.gitleaksignore` versionado con 4 fingerprints documentados como false positives (el mint address público de devUSDC).

## Smoke tests realizados (2026-05-20, devnet)

Todos contra `RPC_URL=https://api.devnet.solana.com`, `NETWORK=devnet`. Wallet generada solo para devnet: `7ud2i3rg79oFgxX3tBHGKDaPAFacEnT2FareDyWzYobC`.

### 1. Arranque sin `.env`

```
npx tsx src/index.ts
```

→ exit 1 con `Falta variable de entorno requerida: PROTOCOL`. Valida que la validación de config rompe antes de cualquier acceso a red. ✅

### 2. Pipeline hasta resolución de posición (placeholder)

`.env` con `ORCA_POSITION_MINT=11111111111111111111111111111111` (System Program, sintácticamente válido pero sin posición Whirlpool asociada).

El bot:
- Carga `.env` y wallet.
- Llama `setRpc(devnet)`.
- Deriva el PDA `P945Sy8GHrhWVwBCX286M1p9RQa1F17PuoX4fgebGLQ` con `getPositionAddress(mint)`.
- Falla limpio en `fetchPosition` con `Account not found at address`.

Valida que el adapter inicializa, conecta a devnet, y deriva direcciones correctamente. ✅

### 3. Cierre dry-run con posición real

Posición abierta vía UI Orca devnet:
- NFT: `C2dpqyoaSs966BH3fNKcSM1FutywwoNYeSX7ybd92Pqj` (Token-2022, supply 1).
- Pool: `3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt` (SOL/devUSDC 0.2%).
- Rango: 25–30 (out-of-range arriba del precio actual 22.37).
- Depósito: 0.1 SOL (100% token A; ver patrón abajo).

`.env`: `DIRECTION=above`, `TARGET_PRICE=20`, `DRY_RUN=true`.

El bot:
- Lee precio `22.370889171507592` (coincide exactamente con la UI).
- Dispara (22.37 ≥ 20).
- Llama `closePosition` en dry-run, devuelve `tokenEstA=99999999` (~0.1 SOL en lamports), `tokenEstB=0`, `feesA=0`, `feesB=0`.
- NO envía tx (`notes: DRY_RUN: no se envió la transacción`). ✅

### 4. Cierre real

Mismo setup que (3) pero `DRY_RUN=false`.

Primer run: 5 fallos en backoff con `Payer not set. Call setPayer() first.` → diagnóstico: el SDK v8 distingue funder (configurado) de payer (no configurado). Fix: `result.callback(this.wallet)` en lugar de `result.callback()`. Ver [ADR-003](DECISIONS.md).

Segundo run:
- Tx enviada y confirmada: `4vaNWkVhgWZY3VrStSo182ajWJHU74tFjKtr3pC22KkRxtPRV9QNrhpdTibhv9F9Mxh3HaLyfgF4mRPz317BqdEb`.
- Verificaciones post-cierre por RPC:
  - `getAccountInfo(P945Sy...)` → `value: null` (cuenta de la posición cerrada).
  - `getAccountInfo(C2dpqyoa...)` → `value: null` (mint del NFT quemado).
  - `getTokenAccountsByOwner(wallet, Token-2022)` → `[]` (sin NFTs).
  - `getTransaction(sig)` → `err: null`, 6 instrucciones (compute budget + decrease liq + collect fees + collect rewards + close position), signer correcto.
- Balance: 1.388 → 1.4979 SOL (+0.11 = liquidez + rent del NFT - fees). ✅

### 6. E2E end-to-end via tRPC (server + adapters + vault + TaskManager)

Validado el 2026-05-20 con el script `scripts/probe-e2e.ts`. Flujo completo:

1. Spawn del server con `WALLET_VAULT_PATH` apuntando a `probe-vault.json` (aislado del vault de producción).
2. `wallet.create` con `wallet.json` parseado como JSON array.
3. `wallet.unlock` con passphrase.
4. `positions.listOwned` para la wallet → encontró 1 posición devnet.
5. `positions.getSummary` → precio actual, range, decimals.
6. `tasks.create` con `target = currentPrice - 0.01` (trigger inmediato), `direction=above`, `EXIT_TOKEN_MINT=devUSDC`, `dryRun=false`, `exitSwapSlippageBps=100`.
7. `tasks.start`.
8. Poll de `tasks.get` hasta `status=done` (transiciones `armed → closing → done` capturadas en el log).
9. `tasks.delete` + cleanup del vault.

Resultado real on-chain:
- **Close tx**: `5xgbNPTFmZmuvy7pkqYsbBcrDvKWxY5u3pPc662R9dMBfcWeE5AkgruqVa8Eq5qSmk5daFZgZv6ZV2zpUmjtibXT`.
- **Swap tx**: `4u7gPeB1e5ECzKsVqnWtScauY46VawzqXXKNRHYzhTJsJw6iwjJm76eEUJf14Yufi4vgNAxYtszYti2gu5i1KDuT`.
- NFT `GjsxHFmpYuhVBDhgoxXBGrmprWufCdmdGC89Fr5oPgcn` → `null` (quemado).
- devUSDC ATA: +2.232531 (= `estimatedOutput` exacto al lamport).
- SOL: +0.0101 (rent NFT recuperado - fees de las 2 txs).

Esto valida que vault + TaskManager + adapters + tRPC funcionan integrados, no solo aisladamente. ✅

### 7. Docker

Validado el 2026-05-20:
- `docker compose build` → OK (Alpine + compilación nativa de better-sqlite3 con node-gyp, ~117s primera vez).
- `docker compose up -d` → arranca, migraciones aplicadas, `/trpc/health` responde.
- `curl http://127.0.0.1:7777/trpc/wallet.status` → lee el vault desde el volumen montado (`./packages/server/data:/app/data`), demuestra persistencia.
- `netstat`: el host muestra `127.0.0.1:7777 LISTENING`, NO `0.0.0.0:7777` → bind localhost-only confirmado.
- `docker compose down` → container, network y puerto liberados limpios.

### 8. Frontend scaffolding (F1.1)

Validado el 2026-05-20:
- `pnpm dev:web` arranca Next.js 15.5 en `127.0.0.1:3000` (no expone a LAN).
- `curl http://127.0.0.1:3000/` → HTTP 200, body con `solana-auto-exit` + clases Tailwind aplicadas.
- `pnpm typecheck` (root + web) pasa.
- Sin lógica de negocio aún; valida que el toolchain está bien conectado.

### 9. Frontend F1 completa (F1.2–F1.6)

Validado el 2026-05-20 con servidor + web corriendo:
- tRPC client tipado: la home muestra el badge `server v0.1.0 · HH:MM:SS` actualizándose cada 10s vía `health.useQuery` (F1.2).
- `/wallet` (F1.3): los tres estados (no-vault / locked / unlocked) responden y permiten el flujo create → unlock → lock → delete con confirm inline.
- `/positions` (F1.4): `positions.listOwned` devuelve las posiciones del wallet desbloqueado; PositionCard llama `getSummary` con dedup de React Query.
- `/positions/[mint]/configure` (F1.5, pre-redesign) → tras R5 fusionada en `/positions/[mint]`: form con TP/SL crea task + start + navega a `/tasks/[id]`.
- `/tasks/[id]` (F1.6): polling cada 2s, controles condicionales por status, receipts con SolscanLink en oxblood-bright.

Las URLs probadas con `curl -o /dev/null -w "%{http_code}"`: `/`, `/wallet`, `/positions`, `/tasks` → todas HTTP 200. `/missing-page` → HTTP 404 con not-found.tsx editorial (post R8).

### 10. UI redesign R1–R8 (trading desk editorial)

Validado el 2026-05-20:
- Fonts cargadas vía next/font (Fraunces, Instrument Sans, JetBrains Mono).
- Paleta oxblood/crema/ink visible en todo el árbol.
- Grain overlay aplicado (mix-blend overlay, 6% opacity).
- Tipografía editorial (`.t-display`, `.t-h1`, etc) en headlines.
- `fade-in` al cargar cada main; `pulse-soft` en dots de estados activos.
- `not-found.tsx` y `error.tsx` editoriales responden con HTTP 404/500 según corresponde.

Las páginas existentes pasaron a renderizar con la nueva estética sin nuevos errores. Typecheck pasa tras cada commit R1–R8.

### 11. Take-profit + Stop-loss simultáneos

Validado el 2026-05-20:
- Migración 0000 regenerada limpia (DB de dev wipeada).
- `pnpm typecheck` pasa con el nuevo schema y los nuevos campos en la API tRPC.
- Server arranca, aplica migración, `/trpc/health` responde.
- Form `/positions/[mint]`: dos `TriggerInput` apilados, ambos toggleables, presets aplicables. Validación zod rechaza `{tp: null, sl: null}` y `{tp <= sl}`.
- **No validado E2E on-chain** todavía con un cierre real disparado por SL. Pendiente cuando haya una posición que cruce el SL en devnet.

### 12. Connect-wallet modal Orca-style

Validado el 2026-05-20:
- `pnpm typecheck` pasa.
- Home renderiza con CTA "Connect bot wallet" cuando no hay vault.
- Modal abre con tabs Generate / Import base58 / Import JSON. Backdrop blur, escape-to-close, body-scroll lock.
- `wallet.generate` mutation produce keypair válida (probado vía round-trip: address devuelta = address derivada del secret base58).
- Vista de éxito requiere checkbox "I've saved this" para habilitar Continue.

### 13. Onboarding redesign (piezas 1–5)

Validado el 2026-05-21:
- `pnpm --filter @solana-auto-exit/web typecheck` pasa verde tras cada pieza implementada (5 typechecks intermedios, todos OK).
- Ambos dev servers arrancan limpios: backend en `http://127.0.0.1:7777` (vault path al persisted), Next.js en `http://127.0.0.1:3000` ("Ready in 13.5s" tras compilación inicial).
- Navegación manual de los nuevos caminos confirmada: `/` (FirstRunHome cuando no hay wallet · DashboardHero cuando sí), `/docs` (index), `/docs/getting-started`, `/docs/bot-wallet`, `/docs/auto-exit`, `/docs/operational`, `/docs/security`, `/docs/faq`. Sidebar de `/docs` muestra el item activo en oxblood, el resto en muted.
- Modal con copy nuevo abre correctamente al pulsar el chip "set up wallet" o el CTA "Create the bot's wallet →". Tres tabs sin badge "recommended". Preamble y `ImportWarning` visibles en cada flujo.
- Empty state `EmptyOwnedList` en `/positions` muestra la address de la bot wallet con botón "copy" funcional (copia al portapapeles via `navigator.clipboard.writeText`).
- Links contextuales navegan correctamente a los artículos correspondientes; el link desde el modal cierra el modal antes de navegar (vía `onClick={close}`).
- **No validado E2E on-chain** en esta sesión — la sesión fue puramente de UX y copy. La mecánica de auto-exit no se tocó.

### 14. F2.1 — History endpoint + activity timeline

Validado el 2026-05-21:
- `pnpm typecheck` (root + web) pasa.
- Backend ya emitía eventos a la tabla `history` desde F0.6 — el cambio es exponerlos. Procedure `tasks.history.query({ id })` validada con el typecheck del tipo `inferRouterOutputs<AppRouter>["tasks"]["history"]` que infiere correctamente el shape `Array<{ id, taskId, timestamp, event, data }>`.
- Componente `ActivityTimeline` montado al final del Dashboard de `/tasks/[id]`. Polling cada 5s (lento porque los eventos son raros). Si no hay eventos, no renderiza nada (tasks recién creadas vienen con un evento `created`, así que en la práctica siempre hay al menos uno).
- Render verificado para cada tipo de evento via `describeEvent`: created, started, resumed, paused (con sub-razones user/vault-locked/server-restart), stopped, triggered (con `triggeredBy`), closed (con `dryRun` + SolscanLink), swapped (con `dryRun`/`skipped`/`txId`), error (con mensaje).
- **No validado E2E on-chain** — la lógica ya existía en F0.6 (los eventos se insertaban); F2.1 solo añade exposición + render.

### 15. F2.2 + F2.3 + F2.4 — On-chain verification + receipts + persisted mints

Validado el 2026-05-21:
- `pnpm typecheck` pasa tras cada sub-pieza (3 typechecks intermedios verdes).
- `verifyTxBalances` revisado contra el shape del response de `getTransaction` con `encoding: "jsonParsed", maxSupportedTransactionVersion: 0`: extrae `meta.fee`, `meta.preBalances/postBalances` por accountKey index, y `meta.preTokenBalances/postTokenBalances` filtrados por `owner === botWallet` y agregados por mint. Devuelve `bigint`, serializado a string en el evento `history`.
- Retry lineal 5x con backoff `500ms × (i+1)` ejercitado vía pipe-test: el handler captura `Tx not yet indexed` como caso retryable y `RPC HTTP <code>` / errores de fetch como retryable también.
- `verifyAndRecord` solo se llama si `!row.dryRun && typeof closeResult.txId === "string"` (similar para swap). En dry-run no hay tx, así que no hay nada que verificar.
- `ActualLine` renderizado verificado manualmente abriendo un task `done` en devnet de un experimento previo y comprobando que el quoted aparece arriba y el actual con diff debajo. Para tasks anteriores a F2.2 que no tienen evento `verified`, el `ActualLine` simplemente no se renderiza.
- Heurística "SOL en A, devUSDC en B" eliminada del Dashboard: `protocolConfig.tokenMintA/B` se leen del task row. Para tasks creados antes de F2.4 que no tienen los mints en `protocolConfig`, el fallback heurístico previo sigue activo (`mintA = SOL_MINT`, `mintB = exitTokenMint ?? devUSDC`).
- **No validado E2E on-chain en esta sesión** — la verification se ejercitará la próxima vez que se dispare un close real en devnet. Pendiente para una validación dedicada cuando haya tx fresca.

### 16. F3 — Settings page + onboarding amable

Validado el 2026-05-21:
- `pnpm typecheck` pasa tras cada sub-pieza (4 typechecks intermedios verdes).
- Settings router: `settings.get` devuelve los defaults hardcoded cuando la tabla está vacía. `settings.update` con cada key del discriminated union zod testeable manualmente vía la página `/settings`. `settings.reset` borra todas las filas.
- Tabla `settings` en SQLite (key/value text) ya estaba en el schema desde F0; F3.1 la activa. Sin migración necesaria.
- `/settings` page renderiza el form unificado con los cuatro inputs (RPC URL + tres slippage/poll). Dirty-tracking funciona — el botón "Save changes" se habilita solo cuando hay cambios. Tras save, feedback "Saved." durante 2.5s. Reset to defaults pide confirmación.
- Wire de defaults verificado: con un `defaultSlippageBps=75` en settings, el ConfigureForm de un `/positions/[mint]` pre-llena el slippage a 75 (ningún chip de preset queda highlighted porque 75 no está entre 50/100/200/500, pero el valor se acepta).
- `wallet.balance` consultado con éxito tras Generate: el modal post-Generate muestra `0 SOL` mientras la wallet está vacía y refresca cada 5s. La URL del faucet de devnet (`https://faucet.solana.com/?walletAddress=...&amount=1&network=devnet`) abre con el address pre-rellenado.
- QR del address generado con `qrcode.react` se renderiza con fondo blanco + ink oscuro (verificado en navegador). Tamaño 132px, escala bien en mobile.
- **No validado**: el flujo completo "Generate → escanear QR desde Backpack móvil → fondear → ver balance subir" no se ha hecho como cadena; verificado por partes.

### 17. F4.3 — Mainnet UI gate

Validado el 2026-05-21:
- `pnpm typecheck` pasa (server + web).
- Sin `ALLOW_MAINNET_LIVE=true` en el env del server (caso por defecto): `settings.get` devuelve `mainnetGateAllowed: false` y `/settings` renderiza el sub-componente `GateClosed` con el mensaje explicativo + el env-var concreto que hay que setear. El botón "Switch to mainnet" no aparece.
- Si alguien forzase `settings.update({key:"network", value:"mainnet"})` directamente (cliente tRPC pirata): el handler lanza `FORBIDDEN` ("Mainnet is not enabled on this server"). Verificado por inspección del código + intento manual via devtools console.
- `tasks.create` con `network: "mainnet"` y env-var ausente lanza también `FORBIDDEN`. Doble red.
- Con `ALLOW_MAINNET_LIVE=true` activado (no probado en esta sesión pero la lógica es trivialmente correcta): `mainnetGateAllowed: true` en el snapshot, aparece el `SwitchToMainnetAction`, el panel pide checkbox obligatorio antes de habilitar el CTA en `variant=danger`.
- Defensa-en-profundidad on read: si el server tiene `"mainnet"` guardado en la tabla `settings` pero el env-var ya no está (server reiniciado sin el flag), `settings.get` devuelve `"devnet"`. Verificado por code review.
- GlobalHeader pinta píldora oxblood con dot pulsante cuando network=mainnet. No tocada en esta sesión (network real sigue siendo devnet), pero el render es deterministic basado en `settings.network`.

### 18. F6.1 — Meteora DLMM adapter read-only + UI aggregation

Validado el 2026-05-21:
- `pnpm typecheck` pasa tras F6.1.a + F6.1.b (2 typechecks intermedios verdes).
- `pnpm tsx scripts/probe-meteora.ts 8CLzaUjGcmftioCfN6eqFEG7xowYzfEciMuGUKvJamAp --mainnet` ejecutado contra mainnet con una posición real ajena. El probe:
  - Detectó que el input era un PDA de posición (owner program = `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`).
  - Extrajo la wallet propietaria del byte layout (offset 40-72): `5CqhWpj3CT17Ji1n7a5qV9dW538oChawJVWZQavg2fTS`.
  - `listOwnedPositions` devolvió **2 posiciones DLMM** en ~5.5s contra el RPC público.
  - `getPositionSummary` por cada una: tokens SOL/USDC, precios actuales (87.00 y 86.85 USDC/SOL en el momento del probe), ranges (82.35–86.23 OUT y 72.12–86.85 IN), liquidity (0 SOL + USDC, posiciones 100% en USDC out-of-range arriba), fees pending coherentes.
  - `getPrice` devolvió el mismo valor que el `currentPrice` del summary (consistencia interna).
- El log `bigint: Failed to load bindings, pure JS will be used` es esperado (módulo nativo opcional con fallback JS funcional; ADR-024 lo documenta).
- Bug ESM/CJS de anchor encontrado y resuelto durante la implementación: el primer intento de cargar el SDK falló con `SyntaxError: ... 'BN'`; arreglado con `createRequire` (ver [ADR-024](DECISIONS.md) + comment en `meteora/adapter.ts`).
- `getPositionSummary` ya **no requiere** `attachWallet()` (refactor F6.1.b): extrae el owner del byte layout. Verificado: la procedure `positions.getSummary` del backend no llama a `attachWallet` y la página `/positions/[mint]` carga el summary correctamente.
- **No validado E2E en browser**: F6.1.b dejó la UI lista para listar Orca + Meteora en paralelo, pero la bot wallet del server actual no tiene posiciones DLMM en devnet. Validar end-to-end requeriría abrir una posición DLMM real en devnet o mainnet con la bot wallet. Trust actual: typecheck verde + probe contra mainnet + revisión visual del render.

### 19. F6.2 — Meteora `closePosition` (dry-run + real path + UI)

Validado el 2026-05-21:
- `pnpm typecheck` pasa tras cada sub-pieza (3 typechecks intermedios verdes: F6.2.a, F6.2.b, F6.2.c).
- **F6.2.a (dry-run)**: `pnpm tsx scripts/probe-meteora.ts <PDA> --mainnet --close-dry-run` ejecutado contra la posición real del amigo. El probe extrae el owner del byte layout, llama `closePosition(dryRun=true)`, y devuelve un quote idéntico a la liquidez + fees que ya muestra `getPositionSummary` para esa posición. Consistencia interna verificada.
- **F6.2.b (real path)**: NO validado end-to-end. Implementación typecheck-verde + verificación lógica:
  - `WalletVault.getRawSecret()` devuelve los bytes en memoria, `lock()` los pone a cero (audit visual del código).
  - `MeteoraAdapter.attachWallet` con `rawSecret` construye `Keypair.fromSecretKey(...)` y compara `signingKeypair.publicKey.toBase58() === wallet.address` (sanity de paridad).
  - El path "owner de la posición != signing wallet" lanza error explícito antes de tocar el SDK.
  - El edge case "SDK devuelve 0 txs" se maneja sin error (caso "posición ya cerrada").
  - El path real con `dlmm.removeLiquidity({ shouldClaimAndClose: true, bps: 10000 })` no se ha ejercido contra mainnet/devnet porque no tenemos una posición DLMM propia que cerrar.
- **F6.2.c (UI)**: typecheck verde. La sección "Output token" del `ConfigureForm` se mostró con el warning Meteora-specific en este sub-paso (luego reactivada en F6.3). El `protocolConfig` por rama (Orca vs Meteora) lo validó tsc al pasar.
- **Pendiente E2E**: cuando un usuario arme un auto-exit Meteora con `dryRun=false` real, ese close ejercitará el path entero (signer conversion + removeLiquidity + sign + send).

### 20. F6.3 — Meteora `swapToExit` (paridad funcional con Orca)

Validado el 2026-05-21:
- `pnpm typecheck` pasa.
- `pnpm tsx scripts/probe-meteora.ts 8CLzaUjGcmftioCfN6eqFEG7xowYzfEciMuGUKvJamAp --mainnet --swap-dry-run` ejecutado contra mainnet. El probe encadena `closePosition(dryRun)` → `swapToExit(dryRun)` en **ambas direcciones**. Resultados:
  - **`closePosition(dryRun)`**: receive 0.001477065 SOL + 11.924276 USDC, fees 0.000121595 SOL + 0.01389 USDC. (Misma posición que F6.1, drift mínimo del valor por movimiento de precio entre sesiones).
  - **`swapToExit(USDC → SOL, dryRun)`**: in 11.938166 USDC (LP + fees), estOut 0.137180 SOL, minOut 0.135808 SOL (slippage 100bps aplicado, deja -0.99% al min).
  - **`swapToExit(SOL → USDC, dryRun)`**: in 0.001599 SOL, estOut 0.138303 USDC, minOut 0.136919 USDC.
- Verificación numérica: a precio 86.85 USDC/SOL y fee del pool 0.2%:
  - USDC → SOL: 11.94 / 86.85 = 0.1375 SOL bruto → 0.137 con fee. ✓
  - SOL → USDC: 0.001599 × 86.85 = 0.1389 USDC bruto → 0.138 con fee. ✓
- La lógica de `swapForY` (decide qué dirección llamar al SDK) y la suma `LP withdraw + fees` por lado funcionan correctamente.
- **Real path NO validado E2E**: requiere posición DLMM propia. Trust: typecheck verde + `dlmm.swap({...})` recibe exactamente los mismos args que el quote (mismos binArraysPubkey, mismo inAmount, mismo minOutAmount), así que si el quote es coherente, el real path solo añade firma + envío.

### 21. F4.1.a — Tauri scaffolding

Validado el 2026-05-21:
- `pnpm install` desde la raíz reconoce el nuevo package (`packages/tauri/`). Workspace pnpm crece a 6 packages (engine, cli, server, web, tauri + root). No hay errores de resolución.
- `pnpm --filter @solana-auto-exit/tauri exec tauri --version` imprime `tauri-cli 2.11.2`. La CLI se invoca correctamente desde el package.
- `pnpm typecheck` verde (los archivos Rust quedan fuera del scope tsc).
- Inspección manual de los archivos generados:
  - `tauri.conf.json` parsea como JSON válido (schema `https://schema.tauri.app/config/2`).
  - `Cargo.toml` es un manifest TOML válido con perfil release optimizado (`lto`, `opt-level = "s"`, `strip`, `panic = "abort"`, `codegen-units = 1`).
  - `src/main.rs` y `src/lib.rs` son el patrón estándar v2 (main wrapper que llama a `lib::run()`).

**No validado E2E**: el usuario aún no ha instalado Rust toolchain ni Microsoft C++ Build Tools en su máquina Windows. Hasta que lo haga, `pnpm tauri:dev` no puede compilar el crate. La primera vez compilará ~1-2 min descargando crates (`tauri`, `wry`, ~200 deps transitivas) y abrirá una ventana nativa. Si truena por algún detalle del SDK de Windows o las features de Tauri, hay que iterar — F4.1.a es el código fuente; F4.1.a-validation es lo que sigue cuando el usuario tenga el toolchain.

Sidecar (F4.1.b) y bundle de producción siguen pendientes — `pnpm tauri:build` fallará hoy por (a) frontend sin static export, (b) backend sin bundlear, (c) iconos sin crear. Todos los pendientes están listados en el README del package.

### 22. F4.1.b verificado — sidecar Tauri rediseñado

Validado el 2026-05-22 (instalados Bun 1.3.14 + Rust 1.95; MSVC Build Tools ya estaba):

- El enfoque de ADR-029 (`bun build --compile` → binario único) resultó inviable. Tres muros, cada uno verificado ejecutando el binario: `better-sqlite3` (módulo nativo) no resuelve su `.node` dentro del binario; el bundler de Bun rompe el glue WASM de `@orca-so/whirlpools-core`; `@meteora-ag/dlmm` se carga vía `createRequire` y el bundler nunca lo ve. Decisión en [ADR-031](DECISIONS.md).
- Rediseño: driver SQLite dual (`bun:sqlite` en el sidecar, `better-sqlite3` en Node/dev) + el sidecar pasa a ser el runtime `bun` ejecutando el server desplegado con `pnpm deploy`.
- `pnpm typecheck` verde y `pnpm test` 53/53 verde tras el refactor de `db/client.ts`.
- `pnpm tauri:dev` arranca end-to-end: Rust compila, la ventana abre, `[sidecar] [server] listening on http://127.0.0.1:7777`, `GET / 200`. La primera compilación de Rust destapó un borrow-checker E0597 latente en `lib.rs` (handler `RunEvent::Exit`), corregido.

### 23. F4.2 — instalador Tauri + auto-update

Validado el 2026-05-22:

- **F4.2.a**: `pnpm tauri:build` produce `.msi` (66 MB) + `.exe` NSIS (38 MB). El exe release arranca el sidecar end-to-end — `sidecar.log` (nuevo, en app-data) confirma `[server] listening`. Bug encontrado y corregido: `resource_dir()` devuelve rutas con prefijo verbatim `\\?\` en Windows; el sidecar (JS) concatena rutas con `/` y `\\?\` no lo tolera → drizzle no encontraba `meta/_journal.json`. Fix: `strip_verbatim()` en `lib.rs`.
- **F4.2.b**: `cargo build` compila con `tauri-plugin-updater` 2.10.1 + `tauri-plugin-dialog` 2.7.1. `pnpm tauri:dev` confirma que la app arranca, el updater corre al arrancar y degrada bien (`[updater] check falló: Could not fetch a valid release JSON` — esperado sin release publicada).
- Nuevo job de CI `sidecar-smoke` (ver tabla CI arriba): arranca el server bajo Bun y comprueba que responde — ejercita `bun:sqlite` en cada build.
- **No verificado**: el flujo real de descarga + instalación de un update (requiere una release publicada); el install-test del `.msi` instalándolo de verdad en el sistema. El primer release del maintainer (ver [RELEASING.md](RELEASING.md)) cerrará esa verificación.

---

### 24. F4.2.b — updater opt-in + fix `window.confirm`

Verificado a mano en `tauri dev` el 2026-05-22:

- **Updater opt-in**: el panel "Updates" aparece en `/settings`, off por defecto. Activarlo a On no lanza error y persiste tras recargar. Con el opt-in en off, el arranque no emite ninguna línea `[updater]` — `check_for_updates` retorna antes de cualquier fetch a GitHub. Ver [ADR-033](DECISIONS.md).
- **`window.confirm`**: "Reset to defaults" en `/settings` muestra un diálogo nativo OK/Cancel — sin el error `dialog.confirm not allowed. Command not found` que daba la regresión de F4.2.b. Cancel no hace nada; OK resetea. Ver [ADR-034](DECISIONS.md).
- El fix `confirm_fix_plugin` cubre los 3 `confirm()` del web (`/settings` reset, toggle TEST/REAL, borrar task).

Nota: supersede el "el updater corre al arrancar" del punto 23 — desde esta sesión el check es opt-in.

---

### 25. Primer install-test real + release v0.1.0

Verificado el 2026-05-22 instalando el `.exe` empaquetado en el sistema —
la verificación que F4.2 (punto 23) había dejado explícitamente pendiente:

- **Bug encontrado — CORS**: la app instalada arrancaba pero el frontend no llegaba al sidecar ("bot inalcanzable"). El origin del webview de Tauri en Windows (`http://tauri.localhost`) no estaba en la lista CORS del server. Arreglado (`9d32963`).
- **Bug encontrado — rutas dinámicas**: con CORS arreglado, navegar a una posición o task fallaba — las rutas dinámicas no resuelven en el HTML estático. Arreglado con navegación por query string (`84a6de0`, [ADR-035](DECISIONS.md)).
- Tras el tercer build, install-test OK: la app instala, arranca, conecta wallet, lista posiciones y navega a configurar un auto-exit.
- **Release `v0.1.0` publicada** en GitHub con instalador firmado + `.msi` + `latest.json` + `SHA256SUMS.txt`.

Pendiente de verificar: el flujo real de un *update* descargado e instalado (requiere una v0.1.x posterior con el opt-in activado).

### 26. Docker self-hosted server + web — walkthrough end-to-end

Verificado el 2026-05-27 sobre `feature/docker-web` antes del merge a `main`. Cierra el sprint Docker iniciado el 22 — la sección #7 cubrió solo el backend; esta valida el stack completo server + web.

- `docker compose up --build -d` levanta dos contenedores desde una imagen: `solana-auto-exit-server` (:7777) y `solana-auto-exit-web` (:3000). Ambos `127.0.0.1` (loopback-only).
- Health probes desde el host:
  - `curl http://127.0.0.1:7777/trpc/settings.get` → HTTP 200 (tRPC responde).
  - `curl http://127.0.0.1:3000/` → HTTP 200 (Next.js sirve la home).
- Server log inicial: `[server] listening on http://0.0.0.0:7777`, `[server] vault path: /app/data/wallet.vault`. Migraciones aplicadas.
- Walkthrough manual desde `http://127.0.0.1:3000`:
  - `/settings`: get / update / reset OK; toggle network devnet↔mainnet persiste + píldora oxblood; toggle EN/ES.
  - `/wallet`: generate (modal + secret revealable + checkbox); lock / unlock con passphrase mal → mensaje claro; rate-limiter activo al sexto intento; import con homoglifos → mensaje del fix `82aa750` nombra los caracteres no-base58 con su code point.
  - `/positions` + `/positions/[mint]`: aggregación Orca / Meteora; configure form con TP + SL.
  - `/tasks` + `/tasks/[id]`: 2 tasks `armed` creadas durante el walkthrough; polling, PoolState, distances, timeline. Borradas vía `curl POST /trpc/tasks.delete` al cerrar.
  - `/docs`: 7 artículos cargan; las secciones "Lock and unlock" y "Server restarts and the locked state" de `/docs/operational` cubren la mecánica del vault encriptado en disco + clave en RAM para firmar.
- Cleanup: `docker compose down` libera containers, network y puertos. Datos persisten en `./packages/server/data/` (bind volume) — si el usuario lo borra, vault y DB se pierden irrecuperables.

Hallazgos apuntados al backlog (no bloquean):

- **`/settings` muestra el `ZodError` como JSON crudo**: pegar `oo.mainnet-beta.solana.com` (sin scheme) devuelve `[ { "validation": "url", ... } ]` literal. El catch hace `err.message` directo. Papercut UX común al web (no es de la rama Docker).
- **Ruido en logs del server al arrancar**: 3 `ConnectTimeoutError` a `api.{mainnet-beta,devnet}.solana.com:443` ("Error getting chain ID from genesis hash"). Sospecha: algún SDK hace un probe a las URLs públicas por defecto, ignorando el `rpcUrl` configurado. No afecta a la funcionalidad.

---

## Anexo: validación previa de `EXIT_TOKEN_MINT` desde CLI (pre-server)

Validado end-to-end en devnet el 2026-05-20.

Setup:
- Posición nueva (NFT `G1b6Sp1UWC8YoKgWDfkspM7t6t9m4XpFbjb3dtNPJnCz`) en el mismo pool `3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt`, mismo patrón out-of-range 25–30, depósito 0.05 SOL.
- `.env`: `EXIT_TOKEN_MINT=BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k` (devUSDC), `EXIT_SWAP_SLIPPAGE_BPS=100`, `DIRECTION=above TARGET_PRICE=20`.

Pasada 1 (`DRY_RUN=true`):
- Close quote: `tokenEstA=49999999` (~0.05 SOL), `tokenEstB=0`.
- Swap quote: `fromMint=SOL`, `in=49999999`, `estOut=1116296`, `minOut=1105133` (slippage 100bps aplicado).
- Sanity: 0.05 SOL × precio 22.37 ≈ 1.118 USDC; quote 1.116 (fee 0.2% del pool restado). ✅

Pasada 2 (`DRY_RUN=false`):
- **Close tx**: `3GBgdoBvbjG34iV7b5bv6FgmAnyvYAqcVo6J3YN44k7sCh23czKaFCBAeRnLD1a5Hma24kxxTDPxnMZ17SXCdpK8`.
- **Swap tx**: `4q4Xi2UGF19UFu13sU4QooLGaC8gY9syNJrufguFS1DLsu7N3pUkvpJK3mBytuxBhe5WZXFMaTMDhzo5u8AKcBS3`.
- Ambas exitosas a la primera, sin retries.

Verificación on-chain post:
- `getAccountInfo(G1b6Sp1…JnCz)` → `value: null` (NFT quemado).
- ATA devUSDC `FPHgMGrNDGbnjjuhfimS2WFVkbDnC6TReXgrvhNKsHJ6` → balance `1.116296` devUSDC (`1116296` raw, **exacto** al `estimatedOutput`).
- Saldo SOL: 1.4378 → 1.4479 (+0.0101 por rent NFT + leftover del wrap; los 0.05 SOL del close acabaron en devUSDC).

Coste total del experimento (open + close + swap + fees): ~0.005 SOL. ✅

## Patrón "posición out-of-range con un solo token"

Para abrir posiciones de prueba sin necesitar los dos tokens:

- En un pool A/B con A el token con menor address (típicamente SOL en SOL/USDC), abrir un rango **enteramente por encima** del precio actual deposita 100% A.
- Inversamente, un rango **enteramente por debajo** del precio actual deposita 100% B.

Útil cuando el agregador (Titan, Jupiter) no tiene rutas en devnet para el autoswap de la UI de Orca, como ocurrió en nuestras pruebas.

## Comandos rápidos

| Acción | Comando |
|---|---|
| Typecheck | `npm run typecheck` |
| Arrancar bot | `npm start` |
| Generar wallet devnet | `npx tsx scripts/gen-wallet.ts` |
| Exportar wallet a base58 (Phantom/Backpack) | `npx tsx scripts/export-base58.ts` |
| Balance vía RPC | `curl -s -X POST -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["<address>"]}' https://api.devnet.solana.com` |
| Tx en Solscan | `https://solscan.io/tx/<sig>?cluster=devnet` |
| Cuenta en Solscan | `https://solscan.io/account/<addr>?cluster=devnet` |
