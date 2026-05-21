# Meteora DLMM adapter

**Paridad funcional con Orca** tras F6.1 + F6.2 + F6.3.

## SDK + interop

- `@meteora-ag/dlmm@^1.9.10`. Bundle CJS via `createRequire` para evitar el problema ESM de `@coral-xyz/anchor` (no re-exporta `BN` como named ESM export).
- Coexistencia con el adapter de Orca a pesar del mismatch de SDK (`@solana/web3.js@^1` vs `@solana/kit@^5`). La frontera del `ProtocolAdapter` pasa primitivos, así que cada adapter encapsula su SDK sin contagio. Decisión arquitectónica en [ADR-024](../../../../../docs/DECISIONS.md).
- Firma con `Keypair` de `@solana/web3.js@^1` construido desde los 64 bytes del vault (`WalletVault.getRawSecret()`). El `KeyPairSigner` de kit no es utilizable directamente porque su CryptoKey es non-extractable.

## Operaciones soportadas

### Read-only (F6.1)

- **`listOwnedPositions(owner)`** — `DLMM.getAllLbPairPositionsByUser(connection, owner)`. Devuelve un `PositionRef` por posición (cada par puede tener varias con distintos rangos de bins).
- **`getPositionSummary(ref)`** — current price del active bin, range (bins → price con `getPriceOfBinByBinId` + `fromPricePerLamport`), liquidity por token, fees pending. Bin step → label de fee porcentual. Self-sufficient: extrae el owner del byte layout de la position account, no requiere `attachWallet`.
- **`getPrice(position)`** — `DLMM.create(lbPair).getActiveBin().pricePerToken`.

### Close (F6.2)

- **`closePosition(position, slippageBps, dryRun)`**:
  - Dry-run: lee positionData y devuelve `CloseResult` con `totalXAmount + totalYAmount + feeX + feeY` como quote. Sin firma.
  - Real: `dlmm.removeLiquidity({ user, position, fromBinId, toBinId, bps: new BN(10000), shouldClaimAndClose: true })` retira 100% + claim fees + close PDA en una sola call. Devuelve `Transaction[]` (multiple si los bins no caben en una tx por compute units). Itera firmando + enviando.

### Swap-to-exit (F6.3)

- **`swapToExit(position, exitTokenMint, closeResult, slippageBps, dryRun)`**:
  - Valida que `exitTokenMint` sea uno de los del pool (reafirma ADR-008).
  - Calcula `swapForY` según dirección y `fromAmount = LP withdraw + fees` del lado correcto.
  - Si `fromAmount === 0n`: devuelve `{ skipped: true }`.
  - Quote vía `dlmm.swapQuote` con `getBinArrayForSwap`.
  - Real: `dlmm.swap({...})` construye `Transaction`, firmamos + enviamos.

### Helper estático

- **`MeteoraAdapter.resolveOwnerOf(rpcUrl, address)`** — detecta si una address es PDA de posición Meteora (`owner program = LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`) y extrae la wallet propietaria del byte layout (`discriminator(8) + lbPair(32) + owner(32) + …`). Útil para pegados de Solscan donde se comparte la posición, no la wallet.

## Probe script

```bash
# Read-only: lista posiciones + summary + getPrice
pnpm tsx scripts/probe-meteora.ts <ownerAddress|positionAddress> [--mainnet]

# Encadena closePosition(dryRun)
pnpm tsx scripts/probe-meteora.ts <addr> --mainnet --close-dry-run

# Encadena closePosition + swapToExit en ambas direcciones (dryRun)
pnpm tsx scripts/probe-meteora.ts <addr> --mainnet --swap-dry-run
```

Si pasas la address de un PDA de posición (lo que Solscan muestra cuando alguien comparte una posición), el probe extrae automáticamente la owner y lista todas sus posiciones DLMM.

## Estado de validación

- **Read-only y dry-run**: validados contra mainnet con posición real ajena. Quotes coherentes con precio actual + fee del pool + slippage configurado.
- **Real path (cerrar + swap on-chain)**: typecheck verde, pero **no ejercitado E2E** porque no tenemos una posición DLMM propia. Se validará la primera vez que un usuario arme un auto-exit Meteora con `dryRun=false` real.

## Limitaciones conocidas

- `getPositionSummary` llama internamente `getAllLbPairPositionsByUser` (recorre todas las posiciones del owner) en lugar de hacer un fetch dirigido. Para una wallet con N posiciones DLMM es O(N) por cada `/tasks/[id]` que carga summary. Optimizable con `wrapPosition(program, key, accountInfo)` del SDK — está en TODO backlog.
- El `removeLiquidity` con `skipUnwrapSOL: false` (default) hace que la SOL nativa quede en la wallet tras el cierre. Si hay `swapToExit` después, `dlmm.swap` reenvuelve internamente — validado en dry-run.
