# TODO

## En curso

(nada activo)

## Próximo (orden sugerido)

- [ ] **F4.1** — Tauri scaffolding. Crear `packages/tauri/`, configuración
  mínima, app que arranca el sidecar del server + carga el bundle del web
  en una ventana nativa. Requiere instalar Rust toolchain (`rustup`). Build
  dev primero en Windows, luego Mac/Linux.
- [ ] **F4.2** — Codesign + auto-update vía GitHub Releases. `.msi` (Win),
  `.dmg` (Mac, requiere Apple Developer ID — $99/año), `.AppImage` y `.deb`
  (Linux, sin codesign). Auto-update via `tauri-plugin-updater`.
- [ ] **F4.3** — Mainnet UI gate. Botón "switch to mainnet" en /settings con
  confirmación explícita en dos pasos + bloqueo de `tasks.create` si el
  gate no está activado. Hoy mainnet está bloqueado solo en zod del settings
  router (ADR-023); con F4.3 abrimos la puerta tras visual audit (ADR-006).
- [ ] **Abrir el repo a público** (5 min): `gh repo edit --visibility public`.
  Activa GitHub Security advisories automáticamente. Puede ir antes o
  después de F4.1.
- [ ] **F5** — LAN access opcional (token de pareja) + service-of-OS sidecar
  (launchd / systemd / Windows Service) para 24/7 sin Tauri abierto.
  Notificaciones Telegram opcional.
- [ ] **F6** — Adapter Meteora DLMM. Verificar SDK actual antes de tocar
  código; confirmar compatibilidad con `@solana/kit@^5` o decidir el shim.

## Backlog (sin orden)

- [ ] Migrar los artículos de `/docs` de TSX hardcoded a markdown single-source.
  Hoy `packages/web/src/app/docs/{slug}/page.tsx` contiene el copy inline;
  cuando el contenido crezca o queramos servir el mismo texto desde el
  GitHub README, mover a `docs/user-guide/*.md` y renderizar con
  `react-markdown` o MDX. Coste de mantenimiento bajo mientras los
  artículos sean pocos y estables.
- [ ] Renombrar `Recommendation` en `packages/web/src/app/wallet/page.tsx`
  a algo como `ScopePanel`. Su contenido visible ya es "Scope" tras la
  pieza 2; sin impacto funcional, solo coherencia de naming.
- [ ] Diff threshold del receipt configurable. Hoy el ActualLine de F2.3
  colorea warning si `|diff| ≥ 0.01%` hardcoded. Mover a `/settings` como
  `diffWarningThresholdBps` (o equivalente).
- [ ] "Test RPC connection" button en `/settings`. Hoy zod valida que sea
  URL pero no que sea reachable. Un botón que haga un `getHealth` o
  `getSlot` y muestre latencia + versión.
- [ ] Live balance polling también en `/wallet` page. Hoy solo aparece en
  el success screen del modal post-Generate. Sería natural mostrarlo
  siempre que la wallet esté unlocked (junto al address, en el unlock
  section).
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
