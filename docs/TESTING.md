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

### 5. Auto-swap (`EXIT_TOKEN_MINT`)

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
