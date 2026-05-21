# Testing

## Estado actual

**No hay tests automatizados.** Las validaciones realizadas hasta hoy son:

1. **Typecheck**: `npm run typecheck` (= `tsc --noEmit`). Pasa.
2. **Smoke tests manuales** en devnet contra Orca Whirlpools (documentados abajo).

Cubrir `env.ts`, `retry.ts` y `loop.ts` con tests unitarios (`node:test` o `vitest`) está en el [backlog](TODO.md).

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
