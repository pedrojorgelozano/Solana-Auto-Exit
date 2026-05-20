# TODO

## En curso

(nada activo)

## Próximo (orden sugerido)

- [ ] **F2** — Verificación on-chain del Result + History persistida visible.
  Tras un cierre real, refrescar balances on-chain via RPC y compararlos con
  el quote del closeResult/swapResult; mostrar diff en la UI. History
  detallada por task con eventos timestamped (created, started, ticked,
  triggered, closed, swapped, error, paused, resumed, stopped).
- [ ] **F3** — Settings page + onboarding pulido.
  RPC URL configurable (mainnet/devnet/custom), slippage por defecto,
  intervalo de poll por defecto. Onboarding más amable post-Generate
  ("send funds here" con QR del address, link a faucet devnet, etc.).
- [ ] **F4** — Tauri wrapper. Build firmado para Win/Mac/Linux,
  auto-update vía GitHub Releases, SECURITY.md publicado, repo público,
  gate de Mainnet activado tras audit visual.
- [ ] **F5** — LAN access opcional (token de pareja) + service-of-OS sidecar
  (launchd / systemd / Windows Service) para 24/7 sin Tauri abierto.
  Notificaciones Telegram opcional.
- [ ] **F6** — Adapter Meteora DLMM. Verificar SDK actual antes de tocar
  código; confirmar compatibilidad con `@solana/kit@^5` o decidir el shim.

## Backlog (sin orden)

- [ ] Persistir `tokenMintA` y `tokenMintB` del pool en el task row para
  no usar la heurística "SOL en A, devUSDC en B" en `/tasks/[id]`. Esto
  exige resolverlo en `tasks.create` (fetch del pool y serializar mints en
  el row) o en el adapter al `resolvePosition`.
- [ ] Expandir el token registry de `packages/web/src/lib/tokens.ts` con
  más mints conocidos (devnet Orca pools varios, mainnet USDT, mSOL, JitoSOL,
  bonk, etc.). Posiblemente cargar de Jupiter token list en background.
- [ ] Cierre + swap atómico en una sola tx (combinar `closePositionInstructions`
  + `swapInstructions` + `buildAndSendTransaction` de `@orca-so/tx-sender`).
  Elimina el riesgo de slippage entre las dos tx.
- [ ] Anti-flapping: confirmar el trigger durante N ciclos antes de cerrar.
- [ ] `EXIT_TOKEN_MINT` con tokens FUERA del pool (vía Jupiter en mainnet,
  multi-hop). Hoy solo mismo pool (ADR-008).
- [ ] Tests automatizados (hoy 0): empezar por `engine/config/env.ts`,
  `engine/core/retry.ts`, `engine/core/loop.ts`, `server/wallet/vault.ts`,
  `server/tasks/manager.ts` con `node:test` o `vitest`. Incluir un test
  de la lógica TP/SL del watcher.
- [ ] Auto-lock del wallet por inactividad (configurable; default 30 min sin
  operaciones). Hoy no hay timeout.
- [ ] Sustituir el spawn `shell: true` del probe-e2e por `cross-spawn` o
  invocación directa de `node + tsx` para evitar DEP0190.
- [ ] Cifrado opcional del SQLite del server (SQLCipher) para entornos donde
  el disco no esté full-disk-encrypted.
- [ ] Auto-update de Tauri vía GitHub Releases (F5).
- [ ] Validación en backend de "un auto-exit activo por posición" (hoy solo
  en UI). Es espejo de la regla — añadir refine en `tasks.create` o
  check explícito en `TaskManager.createTask`.
- [ ] Manejo explícito de buffer de fees al swapear SOL nativo (hoy delegamos
  al `nativeMintWrappingStrategy` del SDK).
- [ ] Métricas / observabilidad: logs estructurados (JSON), opción de
  exportar a fichero rotado o Prometheus.

## Hecho recientemente

Ver [PROGRESS.md](PROGRESS.md).

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
