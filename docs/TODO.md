# TODO

## En curso

- [ ] **F1 — Front-office Next.js**. Pantallas mínimas (connect/vault → positions → configure → confirm → watching). Devnet only, Orca only. Tauri viene en F4-F5.
  - [x] F1.1 — Scaffolding Next.js + Tailwind 4.
  - [ ] F1.2 — tRPC client tipado + CORS en el server Hono.
  - [ ] F1.3 — Pantalla vault (status / create base58 o JSON / unlock / lock / delete).
  - [ ] F1.4 — Pantalla positions (lista de owned + card con summary + selección).
  - [ ] F1.5 — Configure + confirm task (form con preview del quote en vivo).
  - [ ] F1.6 — Dashboard watching (live status, último precio, log de eventos).

## Próximo (orden sugerido tras F1)

- [ ] **F2** — Pulir el flujo de close real + Result con on-chain verification + History persistido y visible.
- [ ] **F3** — Settings, hot-wallet onboarding ("create dedicated bot wallet" como step amigable), notificaciones Telegram opcionales. Decidir si guía de VPS+Tailscale/Cloudflare Tunnel entra aquí o se difiere.
- [ ] **F4** — Tauri wrapper (`packages/desktop/`), auto-update, builds firmados Win/Mac/Linux. SECURITY.md publicado. Gate de Mainnet activado tras audit visual.
- [ ] **F5** — LAN access para móvil (opcional, token de pareja). Service-of-OS sidecar (launchd/systemd/Windows Service) para 24/7. Posiblemente Telegram bot.
- [ ] **F6** — Adapter de Meteora DLMM. Antes de tocar código, verificar SDK actual en `https://docs.meteora.ag/` y `https://github.com/MeteoraAg/dlmm-sdk`. Confirmar compatibilidad con `@solana/kit@^5` o decidir cómo conviven los stacks.

## Backlog (sin orden)

- [ ] Cierre + swap atómico en una sola tx (combinar `closePositionInstructions` + `swapInstructions` + `buildAndSendTransaction` de `@orca-so/tx-sender`). Elimina el riesgo de slippage entre las dos tx.
- [ ] Anti-flapping: confirmar el trigger durante N ciclos antes de cerrar (evita disparos por ticks ruidosos).
- [ ] `EXIT_TOKEN_MINT` con tokens FUERA del pool (vía Jupiter en mainnet, multi-hop). Hoy solo mismo pool (ADR-008).
- [ ] Tests automatizados: hoy 0. Empezar por `env.ts`, `retry.ts`, `loop.ts`, `wallet/vault.ts`, `tasks/manager.ts` con `node:test` o `vitest`.
- [ ] Manejo explícito de buffer de fees al swapear SOL nativo (hoy delegamos al `nativeMintWrappingStrategy` por defecto del SDK; revisar edge case con balances muy justos).
- [ ] Métricas/observabilidad: logs estructurados (JSON), exportar a fichero rotado o Prometheus.
- [ ] Auto-update del Tauri app vía GitHub Releases (F5).
- [ ] Sustituir el spawn `shell: true` del probe por `cross-spawn` o invocación directa de `node + tsx` para evitar el DEP0190.
- [ ] Sustituir el orphan vault que arrastramos en `packages/server/data/wallet.vault` (timestamp pre-probe) por uno limpio cuando arranquemos a usar el server "de verdad".

## Hecho recientemente

Ver [PROGRESS.md](PROGRESS.md).

- **F0 cerrada al 100%** (8 sub-commits independientes): monorepo pnpm + contrato ampliado + Orca discovery + server tRPC/SQLite + WalletVault + TaskManager + endpoints + Docker. Validada end-to-end on-chain via tRPC.
- **F1.1**: scaffolding Next.js 15 + Tailwind 4 listo, dev server renderiza en `127.0.0.1:3000`.
- Fase 1 anterior (núcleo + adapter Orca v8) y feature `EXIT_TOKEN_MINT` siguen vigentes.
- Script `scripts/inspect-pool.ts` para consultar mints y parámetros de un pool Whirlpool.
- Scripts nuevos: `scripts/probe-vault.ts`, `scripts/probe-discovery.ts`, `scripts/probe-e2e.ts`.
