# Meteora DLMM adapter

Read-only en F6.1. `closePosition` y `swapToExit` lanzan "no implementado" — pendiente F6.2 / F6.3.

## SDK + interop

- `@meteora-ag/dlmm@^1.9.10`. Bundle CJS via `createRequire` para evitar el problema ESM de `@coral-xyz/anchor` (no re-exporta `BN` como named ESM export).
- Coexistencia con el adapter de Orca a pesar del mismatch de SDK (`@solana/web3.js@^1` vs `@solana/kit@^5`). La frontera del `ProtocolAdapter` pasa primitivos, así que cada adapter encapsula su SDK sin contagio (ver discusión en ADR-001 / ADR-024 pendiente de redactar).

## Lo que sí funciona (F6.1)

- `listOwnedPositions(owner)` — `DLMM.getAllLbPairPositionsByUser`. Devuelve un `PositionRef` por posición (cada par puede tener varias).
- `getPositionSummary(ref)` — current price del active bin, range (bins → price), liquidity por token, fees pending. Bin step → label de fee porcentual.
- `getPrice(position)` — `DLMM.create(lbPair).getActiveBin().pricePerToken`.
- `MeteoraAdapter.resolveOwnerOf(rpcUrl, address)` (static) — detecta si una address es un PDA de posición Meteora (owner program = LBCLMM) y extrae la wallet propietaria del byte layout (`discriminator(8) + lbPair(32) + owner(32) + …`). Útil para probes y futuros pegados de Solscan en la UI.

## Lo que NO (todavía)

- `closePosition` (F6.2): retirar liquidez de los bins, recolectar fees + rewards, cerrar el PDA. Hay que convertir el `KeyPairSigner` de kit a un `Keypair` de web3.js v1 para firmar.
- `swapToExit` (F6.3): swap en el mismo pool DLMM tras el cierre. `swapWithPriceImpact` / similar del SDK.
- CLI `.env` flow (`loadProtocolConfig` ya carga `METEORA_LB_PAIR` + `METEORA_POSITION`, pero `resolvePosition` + watcher loop quedan a F6.2).

## Probe

```bash
pnpm tsx scripts/probe-meteora.ts <ownerAddress|positionAddress> [--mainnet]
```

Si pasas la address de un PDA de posición (lo que Solscan muestra cuando alguien comparte una posición), el probe extrae automáticamente la owner y lista todas sus posiciones DLMM.
