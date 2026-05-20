# Arquitectura

## Visión

`solana-auto-exit` es un framework para automatizar el cierre de posiciones de liquidez en protocolos DeFi de Solana. El bot vigila el precio de una posición y, cuando cruza un objetivo (take-profit al subir, stop al bajar), la cierra: recolecta fees y recompensas, retira liquidez, quema el NFT que la representa y opcionalmente swapea el output a un token de salida.

Diseñado como **framework, no como script**: añadir un protocolo nuevo es escribir un adapter (ver [ADR-001](DECISIONS.md)).

Diseñado como **herramienta self-hosted, no como servicio**: cada usuario corre su instancia con su wallet local cifrada — sin custodia de terceros (ver [ADR-009](DECISIONS.md)).

## Modos de ejecución

Tres formas de correr el mismo motor:

| Modo | Cuándo | Cómo arrancar |
|---|---|---|
| **CLI** | Validación rápida, una posición, en tu máquina. `.env` como fuente de config. | `pnpm start` |
| **Server local** | Backend para la UI, multi-posición, persistencia. | `pnpm start:server` |
| **Docker** | "Producción" personal: arranque automático, restart-unless-stopped. | `docker compose up -d` |

Todos los modos bindean por defecto a `127.0.0.1` (ver [ADR-016](DECISIONS.md)).

## Arquitectura de capas

```
┌─────────────────────────────────────────────────────────────────┐
│  packages/web  (Next.js + Tailwind + tRPC client)                │
│  └── pantallas: connect / positions / configure / watching       │
└──────────────────────────────┬──────────────────────────────────┘
                               │  tRPC over HTTP (localhost only)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  packages/server  (Hono + tRPC + Drizzle/SQLite)                 │
│  ├── trpc routers   ── wallet / positions / tasks / health       │
│  ├── TaskManager    ── runWatcher per task, AbortController      │
│  ├── WalletVault    ── scrypt + AES-256-GCM, in-memory keypair   │
│  └── db (sqlite)    ── tasks · history · settings                │
└──────────────────────────────┬──────────────────────────────────┘
                               │  in-process import
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  packages/engine  (núcleo agnóstico al protocolo)                │
│  ├── core/          ── loop + retry + runner + logger            │
│  ├── protocols/     ── ProtocolAdapter contract + registry       │
│  └── protocols/orca ── adapter Orca Whirlpools v8 SDK            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Solana RPC  (devnet o mainnet)                                  │
└─────────────────────────────────────────────────────────────────┘

packages/cli  ── consumidor delgado del engine (modo CLI, .env-based)
scripts/      ── utilidades (gen-wallet, export-base58, inspect-pool,
                 probe-vault, probe-discovery, probe-e2e)
```

## Flujo de una watch-task

```
.env / DB row → adapter.init(common, protocolConfig, wallet) → resolvePosition
                                                              │
                                                              ▼
                                   loop:
                                     price = adapter.getPrice(pos)
                                     if triggered:
                                       close  = withRetry(adapter.closePosition)
                                       if exitTokenMint:
                                         swap = withRetry(adapter.swapToExit)
                                       return "stop"
                                     return "continue"
```

En modo CLI ese flujo lo orquesta `runRunner` directamente. En modo server lo orquesta `TaskManager.runWatcher`, que añade:
- Persistencia del estado (`status`, `lastError`, `closeResult`, `swapResult`) tras cada transición.
- Snapshot en memoria del último precio (`getRunningSnapshot`) para que la UI lo lea sin tocar el RPC en cada renderizado.
- Cancellación cooperativa via `AbortController` (pause / stop).
- Recuperación tras reinicio: tasks activas se ponen en `paused` al boot; el usuario las reanuda manualmente tras unlock del vault (ver [ADR-013](DECISIONS.md)).

## Paquetes

### `packages/engine` (núcleo + adapters)

**Agnóstico al protocolo.** Importa solo SDKs específicos dentro de `protocols/<name>/`.

- `core/logger.ts` — log con timestamp ISO a stdout/stderr.
- `core/retry.ts` — `withRetry(fn, { maxAttempts, baseMs, label })`. Backoff exponencial. Ver [ADR-004](DECISIONS.md).
- `core/loop.ts` — `loop({ pollMs, tick })`. Iteraciones secuenciales con `await`. Ver [ADR-005](DECISIONS.md).
- `core/runner.ts` — `runRunner(opts)` para el caso CLI.
- `protocols/types.ts` — contrato `ProtocolAdapter` + todos los tipos compartidos (`BaseConfig`, `BaseReadOnlyConfig`, `PositionRef`, `PositionSummary`, `ConfigSchema`, `CloseResult`, `SwapExitResult`, etc.).
- `protocols/registry.ts` — `makeAdapter(name) → ProtocolAdapter`. Único sitio donde el núcleo conoce nombres concretos.
- `protocols/orca/` — adapter Orca Whirlpools v8.
- `protocols/meteora/` — stub.
- `config/env.ts` — `loadBaseConfig()` para el CLI (el server obtiene config de la DB, no de env).
- `index.ts` — barrel con la API pública del paquete.

### `packages/cli` (consumidor delgado)

Un solo archivo `src/main.ts` que: `loadBaseConfig` + leer `wallet.json` + `makeAdapter` + `runRunner`. Sigue funcionando para la ejecución original con `.env` + `wallet.json`.

### `packages/server` (servicio backend, F0)

- `src/main.ts` — bootstrap: `runMigrations` + `WalletVault` + `TaskManager.boot()` + Hono + tRPC + listen + shutdown limpio.
- `src/db/schema.ts` — Drizzle: tablas `tasks` (config + estado + resultados), `history` (eventos), `settings`.
- `src/db/client.ts` — abre SQLite con WAL + foreign_keys, aplica migraciones.
- `src/wallet/vault.ts` — `WalletVault` con scrypt + AES-256-GCM. Métodos `create / unlock / lock / delete / status / getKeypair / isUnlocked`. Ver [ADR-012](DECISIONS.md).
- `src/wallet/import.ts` — `bytesFromBase58`, `bytesFromJsonArray` para alimentar al vault.
- `src/tasks/manager.ts` — `TaskManager`. Ver [ADR-013](DECISIONS.md).
- `src/tasks/types.ts` — `CreateTaskInput`, `TaskStatus`, `TaskEvent`.
- `src/trpc/init.ts` — `initTRPC` con context + `errorFormatter` que preserva `error.message`.
- `src/trpc/context.ts` — `AppContext = { db, vault, taskManager }`.
- `src/trpc/router.ts` — compone `health` + `walletRouter` + `positionsRouter` + `tasksRouter`.
- `src/trpc/routers/wallet.ts` — `status / create / unlock / lock / delete`.
- `src/trpc/routers/positions.ts` — `listOwned / getSummary / configSchema`.
- `src/trpc/routers/tasks.ts` — `create / list / get / start / pause / stop / delete`.
- `drizzle/` — migraciones SQL versionadas (sí entran en git; las generadas con `drizzle-kit generate`).

### `packages/web` (frontend, F1 — en construcción)

- `src/app/` — Next.js App Router (`layout.tsx`, `page.tsx`, `globals.css` con tema oscuro).
- F1.2+ añadirá `lib/trpc.ts`, pantallas y componentes UI.

## Contrato `ProtocolAdapter`

```ts
interface ProtocolAdapter {
  readonly name: string;          // "orca", "meteora", ...
  readonly displayName: string;   // "Orca Whirlpools", ...

  // Schema + setup
  getConfigSchema(): ConfigSchema;
  setupRpc(common: BaseReadOnlyConfig): Promise<void>;
  attachWallet(wallet: KeyPairSigner): void;

  // Discovery (read-only; solo requiere setupRpc)
  listOwnedPositions(owner: string): Promise<PositionRef[]>;
  getPositionSummary(ref: PositionRef): Promise<PositionSummary>;
  getPriceHistory?(ref: PositionRef, window: PriceWindow): Promise<PricePoint[]>;

  // CLI-style lifecycle (compat con packages/cli)
  loadProtocolConfig(env: NodeJS.ProcessEnv): unknown;
  init(common: BaseConfig, protocolConfig: unknown, wallet: KeyPairSigner): Promise<void>;
  resolvePosition(): Promise<ResolvedPosition>;

  // Watcher operations
  getPrice(position: ResolvedPosition): Promise<number>;
  closePosition(position, slippageBps, dryRun): Promise<CloseResult>;
  swapToExit(position, exitMint, closeResult, slippageBps, dryRun): Promise<SwapExitResult>;
}
```

`ResolvedPosition.raw` es opaco para el núcleo: el adapter cachea ahí sus structures.

## Layout completo

```
solana-auto-exit/
├── .env.example
├── .env                       (gitignored)
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json               (root con scripts cross-package)
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.json              (typecheck del engine + cli + server; excluye web)
├── orca-auto-exit.ts          (referencia original, fuera del build)
├── wallet.json                (gitignored)
├── CLAUDE.md
├── README.md
├── docs/
│   ├── PROGRESS.md
│   ├── TODO.md
│   ├── DECISIONS.md
│   ├── ARCHITECTURE.md
│   ├── TESTING.md
│   └── sessions/
├── scripts/
│   ├── gen-wallet.ts
│   ├── export-base58.ts
│   ├── inspect-pool.ts
│   ├── probe-vault.ts
│   ├── probe-discovery.ts
│   └── probe-e2e.ts
└── packages/
    ├── engine/                (núcleo + adapters; librería interna)
    │   ├── package.json       (name: @solana-auto-exit/engine)
    │   ├── src/
    │   │   ├── index.ts       (barrel con API pública)
    │   │   ├── config/env.ts
    │   │   ├── core/{logger,retry,loop,runner}.ts
    │   │   └── protocols/
    │   │       ├── {types,registry}.ts
    │   │       ├── orca/{adapter,config}.ts
    │   │       └── meteora/README.md
    ├── cli/                   (entry CLI, .env-based)
    │   ├── package.json       (name: @solana-auto-exit/cli)
    │   └── src/main.ts
    ├── server/                (backend tRPC + SQLite)
    │   ├── package.json       (name: @solana-auto-exit/server)
    │   ├── drizzle.config.ts
    │   ├── drizzle/           (migraciones SQL)
    │   ├── data/              (gitignored: DB + wallet vault)
    │   └── src/
    │       ├── main.ts
    │       ├── db/{schema,client}.ts
    │       ├── wallet/{vault,import}.ts
    │       ├── tasks/{manager,types}.ts
    │       └── trpc/
    │           ├── {init,context,router}.ts
    │           └── routers/{wallet,positions,tasks}.ts
    └── web/                   (frontend Next.js — F1)
        ├── package.json       (name: @solana-auto-exit/web)
        ├── next.config.ts
        ├── postcss.config.mjs
        ├── tsconfig.json
        └── src/app/{layout,page}.tsx + globals.css
```

## Cómo añadir un protocolo nuevo

1. Crear `packages/engine/src/protocols/<name>/`.
2. `config.ts`: implementar `load<Name>Config(env)` (parser de claves env específicas con prefijo `<NAME>_*`).
3. `adapter.ts`: clase que implementa `ProtocolAdapter`. Implementaciones mínimas:
   - `name`, `displayName`.
   - `getConfigSchema()` — schema declarativo para que la UI renderice el form.
   - `setupRpc(common)` — inicializa SDK del protocolo (puede ser estado global del SDK como en Orca v8, o cachear en `this`).
   - `attachWallet(wallet)` — guarda el signer para operaciones de firma.
   - `listOwnedPositions(owner)` — descubrir posiciones del wallet vía el SDK.
   - `getPositionSummary(ref)` — snapshot detallado para las cards.
   - `init(common, protocolConfig, wallet)` — compat CLI; combina setupRpc + attachWallet + cache de protocolConfig.
   - `resolvePosition()` — devuelve `ResolvedPosition` con datos derivados (PDAs, etc.).
   - `getPrice(position)`, `closePosition(...)`, `swapToExit(...)` — operaciones del watcher; deben respetar `dryRun`.
4. Registrar en `packages/engine/src/protocols/registry.ts` (`case "<name>": return new <Name>Adapter();`).
5. Documentar variables específicas en `.env.example`.
6. Añadir entrada en `PROGRESS.md` y, si hubo decisiones de diseño, ADRs en `DECISIONS.md`.

La UI lo recogerá automáticamente cuando llamen `positions.configSchema` con el nuevo nombre de protocolo — el form se renderiza desde el schema declarado, sin tocar código del frontend.

## Restricciones operativas

- Por defecto **todo apunta a devnet** y `DRY_RUN=true`.
- Mainnet en vivo requiere `NETWORK=mainnet` + `DRY_RUN=false` + `ALLOW_MAINNET_LIVE=true` (ver [ADR-006](DECISIONS.md)). El gate también aplicará a la UI cuando se habilite (F4).
- Servidores bindean a `127.0.0.1` por defecto (ver [ADR-016](DECISIONS.md)). Para 24/7 vía VPS, usar Tailscale o Cloudflare Tunnel, **nunca abrir puertos a internet**.
- `wallet.json`, `.env`, `packages/server/data/`, `.next/`, `.claude/` están en `.gitignore`. Verificar con `git status` antes de cada commit.
- TypeScript estricto: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
