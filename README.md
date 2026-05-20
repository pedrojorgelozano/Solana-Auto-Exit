# solana-auto-exit

Framework de auto-exit para posiciones de liquidez en protocolos DeFi de Solana.

El bot vigila el precio de una posición y, cuando cruza un objetivo (take-profit al subir, stop al bajar), la cierra automáticamente: recolecta fees y recompensas, retira liquidez, quema el NFT que la representa y, opcionalmente, swapea el output a un token de salida en la misma pool.

## Estado

| | |
|---|---|
| **Núcleo** (loop, retry, runner, config) | ✅ Funcionando |
| **Adapter Orca Whirlpools** (SDK v8) | ✅ Validado end-to-end en devnet con tx real |
| **Auto-swap tras cierre** (`EXIT_TOKEN_MINT`) | ✅ Implementado · ⏳ Pendiente validación E2E |
| **Adapter Meteora DLMM** | ⏳ Stub, sin implementar (Fase 2) |
| **Tests automatizados** | ❌ Por hacer |

Detalles y txIds de las validaciones en [`docs/TESTING.md`](docs/TESTING.md).

## Por qué framework y no script

Añadir un protocolo nuevo es escribir un adapter en `src/protocols/<name>/` que implementa el contrato `ProtocolAdapter`. El núcleo (loop de polling, política de reintentos, validación de config, safety net mainnet, logging) es común y no se toca.

Diseño detallado en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Decisiones tomadas en [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Stack

- TypeScript estricto, ejecución con `tsx`.
- `@orca-so/whirlpools@^8` + `@orca-so/whirlpools-client@^7` + `@orca-so/whirlpools-core@^3`.
- `@solana/kit@^5` (Web3.js v2; pin v5 por peer de Orca v8, ver [ADR-002](docs/DECISIONS.md)).
- `dotenv` para configuración.

## Modos de ejecución

| Modo | Cuándo | Cómo |
|---|---|---|
| **CLI** | Validación rápida, una posición, en tu máquina | `pnpm start` |
| **Server local** | Probar el backend que la futura UI va a consumir | `pnpm start:server` |
| **Docker** | "Producción" personal: arranca con la máquina, vault encriptada, persistencia | `docker compose up -d` |

Por defecto **todo se ata a `127.0.0.1`** — sin acceso desde la LAN ni internet.

## Quick start (devnet, modo CLI)

Requisitos: Node ≥ 22, pnpm (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env
```

Edita `.env` con tu pool/posición. Las claves mínimas son:

```
PROTOCOL=orca
NETWORK=devnet
RPC_URL=https://api.devnet.solana.com
TARGET_PRICE=170
DIRECTION=above            # o below
SLIPPAGE_BPS=100
POLL_MS=30000
WALLET_PATH=wallet.json
DRY_RUN=true               # por defecto NO envía tx
ORCA_POSITION_MINT=<mint del NFT de tu posición Whirlpool>
ORCA_DECIMALS_A=9
ORCA_DECIMALS_B=6
```

Opcional, para acabar el cierre en un token concreto del pool:

```
EXIT_TOKEN_MINT=<mint de USDC, devUSDC, etc.>
EXIT_SWAP_SLIPPAGE_BPS=100
```

Si no tienes wallet aún:

```bash
npx tsx scripts/gen-wallet.ts        # crea wallet.json y muestra la address
npx tsx scripts/export-base58.ts     # exporta la private key en base58 para Phantom/Backpack
```

Ejecutar:

```bash
pnpm start
```

En `DRY_RUN=true` el bot loguea el precio en cada ciclo y, al disparar el trigger, imprime el quote del cierre (y del swap si está configurado) sin enviar nada a la cadena.

## Quick start (modo Docker)

Requisitos: Docker Desktop (Windows/Mac) o Docker Engine + Compose v2 (Linux).

```bash
docker compose up --build      # primera vez: ~2 min compilando better-sqlite3 nativo
docker compose logs -f         # ver logs en vivo
docker compose down            # parar
```

El servicio:
- Bindea **solo en `127.0.0.1:7777`** (no accesible desde LAN ni internet).
- Persiste SQLite y wallet vault en `./packages/server/data/` (volumen montado al host).
- Reinicia automáticamente (`unless-stopped`) si la máquina o el container caen.

Endpoints:
- `GET /` — sanity check.
- `POST /trpc/*` — tRPC type-safe (los usa la UI; ver `packages/server/src/trpc/routers/`).

Para añadir tu wallet sin tocar disco directamente, usa el endpoint `wallet.create` con base58 de Phantom/Backpack o el JSON del Solana CLI. Ejemplo en `scripts/probe-e2e.ts`.

## Seguridad

- Por defecto **todo apunta a devnet** y `DRY_RUN=true`.
- Operar contra mainnet en vivo requiere combinación explícita: `NETWORK=mainnet` + `DRY_RUN=false` + `ALLOW_MAINNET_LIVE=true`. Si falta cualquiera, el bot aborta al arrancar con mensaje claro. Ver [ADR-006](docs/DECISIONS.md).
- `wallet.json` y `.env` están en `.gitignore`. La clave privada nunca se imprime ni se versiona.
- Para mainnet usa un RPC privado (Helius, Triton, QuickNode). El público se satura.

## Layout

```
src/
├── index.ts                  # entrypoint
├── config/env.ts             # carga .env + valida (común + por adapter)
├── core/                     # agnóstico al protocolo
│   ├── runner.ts             # orquesta adapter + loop + retry
│   ├── loop.ts               # polling secuencial sin solapamientos
│   ├── retry.ts              # backoff exponencial
│   └── logger.ts
└── protocols/
    ├── types.ts              # contrato ProtocolAdapter
    ├── registry.ts           # factory por nombre
    ├── orca/                 # adapter Whirlpools v8
    └── meteora/              # stub Fase 2
```

## Documentación

Toda la documentación viva está en [`docs/`](docs/):

- [`PROGRESS.md`](docs/PROGRESS.md) — bitácora de sesiones.
- [`TODO.md`](docs/TODO.md) — pendientes y backlog.
- [`DECISIONS.md`](docs/DECISIONS.md) — ADRs (decisiones arquitectónicas).
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — diseño detallado.
- [`TESTING.md`](docs/TESTING.md) — qué se valida y cómo reproducirlo.
- [`sessions/`](docs/sessions/) — notas largas por sesión.

## Licencia

Sin licencia pública por ahora (repo privado).
