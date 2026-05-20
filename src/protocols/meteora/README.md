# Meteora (DLMM) — TODO (Fase 2)

Stub. Sin implementación todavía.

## Antes de empezar

1. **Verificar el SDK actual de Meteora en su documentación oficial.** NO asumir API
   de memoria.
   - Repo: https://github.com/MeteoraAg/dlmm-sdk
   - Docs: https://docs.meteora.ag/
2. Confirmar compatibilidad con `@solana/kit` (web3.js v2). Si el SDK de Meteora
   sigue en v1, decidir el shim (envolver Connection/Keypair) o aceptar tener
   ambos stacks coexistiendo.
3. Mapear al contrato `ProtocolAdapter` (ver `src/protocols/types.ts`):
   - Referencia de la posición: ¿position address? ¿pair + bin range + owner?
   - `getPrice`: precio actual del par DLMM (activeId → precio).
   - `closePosition`: retirar liquidez de los bins + recolectar fees + cerrar.

## Cuando esté listo

- Crear `adapter.ts` con `class MeteoraAdapter implements ProtocolAdapter`.
- Crear `config.ts` con las env vars específicas (al menos
  `METEORA_POSITION_ADDRESS` o equivalente; decimales si la conversión de precio
  los requiere).
- Registrar en `src/protocols/registry.ts` (`case "meteora": return new MeteoraAdapter();`).
- Añadir entradas `METEORA_*` al `.env.example`.
