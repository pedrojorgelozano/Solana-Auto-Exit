# Arquitectura

## Visión

`solana-auto-exit` es un framework para automatizar el cierre de posiciones de liquidez en protocolos DeFi de Solana. El bot vigila el precio de una posición y, cuando cruza un objetivo (take-profit al subir, stop al bajar), la cierra: recolecta fees y recompensas, retira liquidez, quema el NFT que la representa y opcionalmente swapea el output a un token de salida.

Diseñado como **framework, no script**: añadir un protocolo nuevo es escribir un adapter sin tocar el núcleo. Ver [ADR-001](DECISIONS.md).

## Flujo de ejecución

```
.env ── loadBaseConfig() ────────────────┐
                                         │
wallet.json ── createKeyPairSignerFromBytes ─┤
                                         │
                                         ▼
                              makeAdapter(protocol)
                                         │
                                         ▼
                  adapter.loadProtocolConfig(env)   ← claves <NAME>_*
                  adapter.init(common, protocolCfg, wallet)
                  adapter.resolvePosition()
                                         │
                                         ▼
                              runner.loop({
                                tick:
                                  price = adapter.getPrice(pos)
                                  if triggered:
                                    close  = withRetry(adapter.closePosition)
                                    if exitTokenMint:
                                      swap = withRetry(adapter.swapToExit)
                                    return "stop"
                                  return "continue"
                              })
```

## Capas

### Núcleo (`src/core/`)

**Agnóstico al protocolo.** No importa ningún SDK específico (ni `@orca-so/*`, ni Meteora). Solo conoce el contrato `ProtocolAdapter`.

- `logger.ts` — log con timestamp ISO a stdout/stderr.
- `retry.ts` — `withRetry(fn, { maxAttempts, baseMs, label })`. Backoff exponencial. Ver [ADR-004](DECISIONS.md).
- `loop.ts` — `loop({ pollMs, tick })`. Iteraciones secuenciales con `await`. Ver [ADR-005](DECISIONS.md).
- `runner.ts` — orquesta `init → resolvePosition → loop`. Tras cierre OK, si hay `exitTokenMint`, encadena `swapToExit` con retry independiente.

### Configuración (`src/config/`)

- `env.ts` — `loadBaseConfig()`. Lee y valida `.env` con `dotenv`. Aplica safety net mainnet (ver [ADR-006](DECISIONS.md)). Devuelve `BaseConfig`.

Cada adapter expone su propio `loadProtocolConfig(env)` para añadir sus claves específicas (prefijo `<NAME>_*`) sin tocar el núcleo.

### Contrato (`src/protocols/types.ts`)

```ts
interface ProtocolAdapter {
  readonly name: string;
  loadProtocolConfig(env: NodeJS.ProcessEnv): unknown;
  init(common: BaseConfig, protocolConfig: unknown, wallet: KeyPairSigner): Promise<void>;
  resolvePosition(): Promise<ResolvedPosition>;
  getPrice(position: ResolvedPosition): Promise<number>;
  closePosition(position, slippageBps, dryRun): Promise<CloseResult>;
  swapToExit(position, exitTokenMint, closeResult, slippageBps, dryRun): Promise<SwapExitResult>;
}
```

`ResolvedPosition.raw` es opaco para el núcleo: el adapter cachea ahí su estado interno (direcciones derivadas, deployment, etc.).

`CloseResult` y `SwapExitResult` normalizan campos (`dryRun`, `txId?`, estimados, fees, notas) para que el runner pueda loguear uniforme y para que la feature de swap pueda consultar el output del close.

### Adapters (`src/protocols/<name>/`)

- **Orca** (`src/protocols/orca/`):
  - `config.ts` → lee `ORCA_POSITION_MINT`, `ORCA_DECIMALS_A`, `ORCA_DECIMALS_B`. Valida tipos y rango.
  - `adapter.ts` → implementa `ProtocolAdapter`. Usa `@orca-so/whirlpools@^8`, `@orca-so/whirlpools-client@^7`, `@orca-so/whirlpools-core@^3`, `@solana/kit@^5`. RPC y funder globales del SDK; payer pasado al callback. Ver [ADR-002](DECISIONS.md) y [ADR-003](DECISIONS.md).
- **Meteora** (`src/protocols/meteora/`): stub. README con pasos previos a implementar (verificar SDK actual, decidir compatibilidad con kit v5).

### Registry (`src/protocols/registry.ts`)

`makeAdapter(name): ProtocolAdapter` — factory por nombre. Único sitio donde el núcleo conoce los nombres concretos. Meteora aún lanza error "no implementado".

### Entry point (`src/index.ts`)

```
loadBaseConfig() → makeAdapter(protocol) → adapter.loadProtocolConfig(env)
 → leer wallet.json → createKeyPairSignerFromBytes
 → runRunner({ adapter, base, protocolConfig, wallet })
```

## Layout de carpetas

```
solana-auto-exit/
├── .env.example
├── .env                    (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
├── orca-auto-exit.ts       (referencia original, fuera del build)
├── wallet.json             (gitignored)
├── CLAUDE.md
├── docs/
│   ├── PROGRESS.md
│   ├── TODO.md
│   ├── DECISIONS.md
│   ├── ARCHITECTURE.md
│   ├── TESTING.md
│   └── sessions/
├── scripts/
│   ├── gen-wallet.ts
│   └── export-base58.ts
└── src/
    ├── index.ts
    ├── config/
    │   └── env.ts
    ├── core/
    │   ├── logger.ts
    │   ├── retry.ts
    │   ├── loop.ts
    │   └── runner.ts
    └── protocols/
        ├── types.ts
        ├── registry.ts
        ├── orca/
        │   ├── adapter.ts
        │   └── config.ts
        └── meteora/
            └── README.md
```

## Cómo añadir un protocolo nuevo

1. Crear `src/protocols/<name>/`.
2. `config.ts`: implementar `load<Name>Config(env)`. Leer y validar sus claves específicas (prefijo `<NAME>_*`). Lanzar error si falta algo obligatorio.
3. `adapter.ts`: clase que implementa `ProtocolAdapter`:
   - `readonly name = "<name>"`.
   - `loadProtocolConfig(env)` delega a tu config.
   - `init(common, protocolConfig, wallet)` configura el SDK del protocolo.
   - `resolvePosition()` devuelve un `ResolvedPosition` cuyo `raw` lleva lo necesario para el resto de métodos.
   - `getPrice(position)` devuelve `number` decimal legible.
   - `closePosition(position, slippageBps, dryRun)` cierra la posición; en `dryRun` NO envía tx, devuelve la quote.
   - `swapToExit(position, exitMint, closeResult, slippageBps, dryRun)` swap del output al token elegido; en `dryRun` NO envía tx.
4. Añadir entrada al `switch` en `src/protocols/registry.ts`.
5. Documentar las nuevas claves en `.env.example` con prefijo `<NAME>_`.
6. Añadir entrada en `PROGRESS.md` y, si hubo decisiones nuevas, ADRs en `DECISIONS.md`.

## Restricciones operativas

- Por defecto todo apunta a **devnet** y `DRY_RUN=true`.
- Mainnet en vivo requiere `NETWORK=mainnet` + `DRY_RUN=false` + `ALLOW_MAINNET_LIVE=true` (ver [ADR-006](DECISIONS.md)).
- `wallet.json` y `.env` están en `.gitignore`. La clave privada nunca se imprime ni se commitea.
- TypeScript estricto: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Typecheck con `npm run typecheck`.
