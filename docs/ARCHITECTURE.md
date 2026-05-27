# Arquitectura

## Visión

`solana-auto-exit` es un framework para automatizar el cierre de posiciones de liquidez en protocolos DeFi de Solana. El bot vigila el precio de una posición y, cuando cruza un objetivo (take-profit al subir, stop al bajar), la cierra: recolecta fees y recompensas, retira liquidez, quema el NFT que la representa y opcionalmente swapea el output a un token de salida.

Diseñado como **framework, no como script**: añadir un protocolo nuevo es escribir un adapter (ver [ADR-001](DECISIONS.md)).

Diseñado como **herramienta self-hosted, no como servicio**: cada usuario corre su instancia con su wallet local cifrada — sin custodia de terceros (ver [ADR-009](DECISIONS.md)).

## Modos de ejecución

Cuatro formas de correr el mismo motor:

| Modo | Cuándo | Cómo arrancar |
|---|---|---|
| **CLI** | Validación rápida, una posición, en tu máquina. `.env` como fuente de config. | `pnpm start` |
| **Server local + Web** | Backend tRPC + UI Next.js en dev. Multi-posición, persistencia, HMR. | `pnpm dev:server` y `pnpm dev:web` |
| **Docker** | Self-hosted en Linux/Mac/Windows sin instalación nativa. Una imagen, dos servicios — server (:7777) + web (:3000) ambos a `127.0.0.1`; abres `http://127.0.0.1:3000` en el navegador. Ver [ADR-036](DECISIONS.md). | `docker compose up -d` |
| **Tauri desktop** | Distribución a usuarios finales. Frontend + server empaquetados en un instalador `.msi`/`.exe`/`.dmg`/`.AppImage` con auto-update. | `pnpm tauri:build` (requiere Bun + Rust + OS build tools — ver [ADR-031](DECISIONS.md)) |

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

### Modo Tauri desktop (capa adicional)

Cuando se construye con `pnpm tauri:build`, una capa extra envuelve el stack:

```
┌─────────────────────────────────────────────────────────────────┐
│  Tauri shell (Rust)                                              │
│  ├── tauri::Builder con setup() que spawn el sidecar             │
│  ├── webview con frontend Next.js bundleado (out/ estático)      │
│  ├── SidecarHandle (Mutex<Option<CommandChild>>) en state        │
│  └── RunEvent::Exit → kill del sidecar antes de cerrar           │
└──────────────────┬────────────────────┬─────────────────────────┘
                   │                    │
                   │ tauri://localhost  │ spawn child process
                   ▼                    ▼
        ┌──────────────────┐   ┌───────────────────────────────┐
        │ webview          │   │ sidecar: el runtime `bun`     │
        │ packages/web/out │   │ ejecuta server-app/src/       │
        │ + useParams()    │   │ main.ts (server desplegado)   │
        └────────┬─────────┘   │ ├── DB_PATH=app_data/auto-... │
                 │             │ ├── WALLET_VAULT_PATH=...     │
                 │ fetch       │ ├── DRIZZLE_MIGRATIONS=res/.. │
                 │             │ └── SERVER_PORT=7777          │
                 └────────────►│ ↳ Hono + tRPC + Drizzle       │
                               └───────────────────────────────┘
```

El sidecar **no es un binario compilado** — es una copia del runtime `bun` que ejecuta el server desplegado (`server-app/`, ver Pipeline de build). `bun --compile` no podía empaquetar las deps WASM/nativas del proyecto; ver [ADR-031](DECISIONS.md). El webview hace fetch a `http://127.0.0.1:7777/trpc/*` (igual que en dev). Los paths runtime (DB, vault, migrations) los resuelve el Rust shell via `app.path().app_data_dir()` y `app.path().resource_dir()` y se los pasa al sidecar como env vars en el momento del spawn. La app comprueba actualizaciones al arrancar ([ADR-032](DECISIONS.md)).

## Pipeline de build (Tauri desktop)

`pnpm tauri:build` encadena, vía `beforeBuildCommand` en `tauri.conf.json`:

```
pnpm tauri:build
  ├── pnpm -w run build:tauri-prep    (beforeBuildCommand)
  │   ├── pnpm build:web-export       → packages/web/out/
  │   │   └── cross-env TAURI_BUILD=1 next build
  │   └── pnpm build:server-binary    → tsx scripts/build-binary.ts
  │       ├── pnpm deploy --legacy --prod --node-linker=hoisted
  │       │     → binaries/server-app/ (server + node_modules
  │       │       plano, sin symlinks, relocatable)
  │       ├── poda data/ y better-sqlite3 del deploy
  │       └── copia el ejecutable `bun` del host
  │             → binaries/auto-exit-server-<triple>[.exe]
  └── cargo build --release (Rust + bundle)
      ├── frontend bundled desde packages/web/out/
      ├── runtime `bun` embebido como externalBin (el sidecar)
      ├── server-app/ copiada como resource
      └── output → packages/tauri/target/release/bundle/{msi,nsis}/
```

El build de release con artefactos de auto-update es `pnpm tauri:release` (= `tauri build --config tauri.updater.conf.json`); ver [RELEASING.md](RELEASING.md).

Decisiones de cada pieza:

- **`output: 'export'` opt-in vía `TAURI_BUILD=1`**: ver [ADR-030](DECISIONS.md). Dev y Docker no se afectan.
- **Sidecar = runtime `bun` + `pnpm deploy`, no `bun --compile`**: ver [ADR-031](DECISIONS.md). El bundler de Bun no podía empaquetar el WASM de Orca ni el `createRequire` de Meteora; el server viaja desplegado con su `node_modules` real (hoisted, relocatable).
- **Auto-update**: `tauri-plugin-updater` con keypair propia, hosting en GitHub Releases. Ver [ADR-032](DECISIONS.md) y [RELEASING.md](RELEASING.md).
- **Iconos**: PNG fuente generado por `packages/tauri/scripts/generate-icon-source.py` (PIL); set completo (ICO, ICNS, iOS, Android, Windows Store) producido por `pnpm exec tauri icon scripts/source.png`.

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
- `protocols/registry.ts` — `makeAdapter(name) → ProtocolAdapter` + `REGISTERED_PROTOCOLS` (export para que la UI itere). Único sitio donde el núcleo conoce nombres concretos.
- `protocols/orca/` — adapter Orca Whirlpools v8 (`@orca-so/whirlpools@^8` + `@solana/kit@^5`).
- `protocols/meteora/` — adapter DLMM con **paridad funcional con Orca** tras F6.1 + F6.2 + F6.3: `listOwnedPositions`, `getPositionSummary`, `getPrice`, `closePosition` (claim fees + remove liquidity + close PDA en una transaction batch vía `removeLiquidity({ shouldClaimAndClose: true })`), `swapToExit` (en el mismo pool DLMM vía `dlmm.swap(...)`). Usa `@meteora-ag/dlmm@^1.9.10` (cargado vía `createRequire` por [ADR-024](DECISIONS.md)) + `@solana/web3.js@^1` + `bn.js@^5.2`. Helper estático `MeteoraAdapter.resolveOwnerOf(rpcUrl, address)` para detectar PDAs de posición Meteora y extraer la wallet propietaria. Firma con `Keypair` de web3.js v1 construido desde los 64 bytes del vault (ver `WalletVault.getRawSecret()`).
- `config/env.ts` — `loadBaseConfig()` para el CLI (el server obtiene config de la DB, no de env).
- `index.ts` — barrel con la API pública del paquete.

### `packages/cli` (consumidor delgado)

Un solo archivo `src/main.ts` que: `loadBaseConfig` + leer `wallet.json` + `makeAdapter` + `runRunner`. Sigue funcionando para la ejecución original con `.env` + `wallet.json`.

### `packages/server` (servicio backend, F0)

- `src/main.ts` — bootstrap: `runMigrations` + `WalletVault` + `TaskManager.boot()` + Hono + tRPC + listen + shutdown limpio.
- `src/db/schema.ts` — Drizzle: tablas `tasks` (config + estado + resultados), `history` (eventos), `settings` (key/value).
- `src/db/client.ts` — abre SQLite con WAL + foreign_keys, aplica migraciones.
- `src/wallet/vault.ts` — `WalletVault` con scrypt + AES-256-GCM. Métodos `create / unlock / lock / delete / status / getKeypair / getRawSecret / isUnlocked`. Tras F6.2.b también cachea los 64 bytes del secret durante unlock para adapters que firman con `Keypair` de web3.js v1 (Meteora); `lock()` los pone a cero antes de soltar la referencia. Ver [ADR-012](DECISIONS.md) y [ADR-024](DECISIONS.md).
- `src/wallet/import.ts` — `bytesFromBase58`, `bytesFromJsonArray` para alimentar al vault.
- `src/tasks/manager.ts` — `TaskManager`. Ver [ADR-013](DECISIONS.md). Emite eventos a `history` y, tras un close/swap real, llama a `verifyAndRecord` (ver `verify.ts`).
- `src/tasks/verify.ts` — verificación on-chain post-tx ([ADR-022](DECISIONS.md)). `verifyTxBalances(rpcUrl, signature, owner)` llama `getTransaction` por JSON-RPC, parsea pre/post balances + token balances, devuelve `{ fee, solDelta, tokenDeltas }` con `bigint`. Retry lineal 5x.
- `src/tasks/types.ts` — `CreateTaskInput`, `TaskStatus`, `TaskEvent` (incluye `"verified"`).
- `src/trpc/init.ts` — `initTRPC` con context + `errorFormatter` que preserva `error.message`.
- `src/trpc/context.ts` — `AppContext = { db, vault, taskManager }`.
- `src/trpc/router.ts` — compone `health` + `walletRouter` + `positionsRouter` + `tasksRouter` + `settingsRouter`.
- `src/trpc/routers/wallet.ts` — `status / generate / create / unlock / lock / delete / balance`. `generate` produce ed25519 vía `node:crypto`, cifra con la passphrase y devuelve el secret en base58 una sola vez (ADR-020). `balance` consulta `getBalance` al RPC del settings (usado por el AddressBlock del modal post-Generate).
- `src/trpc/routers/positions.ts` — `listOwned / getSummary / configSchema`.
- `src/trpc/routers/tasks.ts` — `create / list / get / history / start / pause / stop / delete`. El input de `create` valida con dos `.refine` que al menos uno de `takeProfitPrice`/`stopLossPrice` esté definido y, si ambos, TP > SL (ADR-018). `history` devuelve los eventos de la task más recientes primero ([ADR-022](DECISIONS.md)).
- `src/trpc/routers/settings.ts` — `get / update / reset`. Snapshot tipado con defaults aplicados para keys ausentes. `update` con discriminated union por key; `network` bloqueado a `"devnet"` por zod ([ADR-023](DECISIONS.md)).
- `drizzle/` — migraciones SQL versionadas. La inicial fue `0000_flat_flatman.sql`; tras introducir TP/SL se regeneró como `0000_lumpy_morbius.sql` (DB de dev wipeada — ADR-018).

`packages/server/package.json` expone `exports["./api"]` apuntando a `src/trpc/router.ts` para que el web pueda importar el tipo `AppRouter` sin alcanzar la implementación.

### `packages/web` (frontend Next.js — F1 completa, redesign R1–R8 aplicado)

**Stack**:
- Next.js 15.5 con App Router (`src/app/`).
- Tailwind 4 (sin `tailwind.config.ts`; tokens en `@theme` dentro de `globals.css`).
- React 19 + TanStack Query 5 + `@trpc/react-query`.
- next/font para Fraunces (variable serif, axes opsz + SOFT) + Instrument Sans + JetBrains Mono.

**Layout**:
```
packages/web/src/
├── app/
│   ├── layout.tsx          (fonts, providers, GlobalHeader)
│   ├── page.tsx            (home: FirstRunHome cuando no hay wallet, DashboardHero + Now watching + History cuando sí)
│   ├── globals.css         (tokens + utilidades .t-*)
│   ├── fonts.ts            (next/font config)
│   ├── not-found.tsx       (404 editorial)
│   ├── error.tsx           (error boundary global)
│   ├── wallet/page.tsx     (3 estados + danger zone)
│   ├── settings/page.tsx   (RPC URL + slippages + poll defaults; NetworkPanel con switch a mainnet en 2 pasos cuando ALLOW_MAINNET_LIVE — ADR-023, F4.3)
│   ├── positions/
│   │   ├── page.tsx        (lista agregada Orca + Meteora en paralelo, badge oxblood para Meteora — F6.1.b; EmptyOwnedList pedagógico cuando no hay LPs)
│   │   └── [mint]/page.tsx (recap + form configure con TP/SL + ExistingWatcher si ya hay uno activo; `protocolConfig` y `tasks.create` se construyen por rama de protocolo — Orca vs Meteora — F6.2.c)
│   ├── tasks/
│   │   ├── page.tsx        (ledger denso con filtros)
│   │   └── [id]/page.tsx   (dashboard live + receipts editoriales + ActivityTimeline + ActualLine con diff% — ADR-022)
│   └── docs/               (documentación in-app editorial — ADR-021)
│       ├── layout.tsx                       (sidebar + content)
│       ├── page.tsx                         (índice con los 6 artículos)
│       ├── _components/{articles.ts, DocsNav.tsx, ArticleHeader.tsx}
│       ├── getting-started/page.tsx
│       ├── bot-wallet/page.tsx
│       ├── auto-exit/page.tsx
│       ├── operational/page.tsx
│       ├── security/page.tsx
│       └── faq/page.tsx
├── components/
│   ├── GlobalHeader.tsx    (logo + links Docs/Settings + ServerStatus + VaultChip; píldora oxblood prominente cuando network=mainnet — F4.3)
│   ├── PageHeader.tsx
│   ├── ServerStatus.tsx
│   ├── VaultChip.tsx
│   ├── ConnectWalletModal.tsx  (preamble + 3 tabs honestas + ImportWarning + GenerateSuccess)
│   └── ui/{Button,Card,Input}.tsx
└── lib/
    ├── trpc.ts             (createTRPCReact<AppRouter>)
    ├── providers.tsx       (QueryClient + tRPC + ConnectWalletProvider)
    ├── connect-wallet.tsx  (context + useConnectWallet hook que cualquier client component invoca)
    ├── tokens.ts           (registry SOL/USDC/devUSDC + fallback truncado)
    ├── status.ts           (BackendStatus → StatusView con tones)
    ├── format.ts           (formatTriggers, formatNearestDistance, etc)
    └── constants.ts        (NETWORK, RPC_URL, PROTOCOL hardcoded hasta F3)
```

**Sistema de diseño** (ADR-017):
- Paleta oxblood + crema + ink en CSS vars (`--color-accent`, `--color-text`, etc).
- Tipografía via utilidades `.t-display`, `.t-h1`, `.t-h2`, `.t-h3`, `.t-eyebrow`, `.t-body`, `.t-num`, `.t-num-display`. `t-h3` añadido durante el redesign de onboarding para subsecciones de artículos en `/docs`.
- Composición con hairlines (`hairline-t`, `rule-t`, `divide-y divide-[var(--color-hairline)]`) en lugar de cards apiladas.
- Grain overlay global vía SVG turbulence inline.
- Motion discreto: `.fade-in` (page transitions) y `.pulse-soft` (estados activos).

**Vocabulario de UI** (ADR-017 lo escala): "auto-exit" es el nombre de cara al usuario; internamente sigue siendo `task` en el código. Los estados backend (`armed`, `triggered`, etc) se traducen vía `statusView()` a frases naturales ("Watching", "Target hit", etc).

**Connect-wallet** (ADR-020): cuando no hay vault, el chip del header y el CTA del home abren `ConnectWalletModal` con tres rutas. La Generate-in-server crea la keypair, cifra y devuelve el secret una sola vez para que el usuario lo guarde.

**Triggers TP/SL** (ADR-018): formularios con dos `TriggerInput` (TP verde-positive, SL cobre-warning) independientes con sus propios toggles y presets ±%. Display unificado con `formatTriggers(tp, sl)` → `"TP ≥ 25 · SL ≤ 18"`.

**One-watcher-per-position** (ADR-019): `/positions/[mint]` detecta tasks activos para el mint y renderiza `ExistingWatcher` (con Open / Delete CTAs) en vez del form. `/positions` lista marca con chip pulsante `auto-exit set`.

**Onboarding pedagógico editorial** (ADR-021): cuando no hay wallet, la home renderiza `FirstRunHome` con eyebrow + display + tres steps "How it works" + CTAs. El modal pasa de "Connect bot wallet recomendado / Import peligroso" a tres caminos honestos al mismo nivel (Generate / Import key / Advanced · JSON) con `ImportWarning` que explica el blast radius con precisión (= la address concreta, no la wallet entera; la app no acepta seed phrases). Empty states de `/positions` y `/tasks` enseñan la cadena (positions vacío → cómo meter LPs; tasks vacío → ir a positions). Documentación in-app vive en `app/docs/` con 6 artículos editoriales y un sidebar. Links contextuales ("→ Why a bot wallet?", "→ What simulation actually does", etc) sembrados en los puntos donde aparecen conceptos no obvios — sustituto editorial del tour overlay clásico.

### `packages/tauri` (desktop shell — F4.1 + F4.2 completas)

Wrapper nativo que empaqueta el frontend Next.js + el server como app desktop. Sexto miembro del workspace pnpm. Estrategia en [ADR-015](DECISIONS.md); empaquetado del sidecar en [ADR-031](DECISIONS.md); auto-update en [ADR-032](DECISIONS.md).

**Stack**:
- [Tauri v2](https://v2.tauri.app/) (Rust): `tauri` + `tauri-build` 2.x.
- Plugins: `tauri-plugin-shell` (spawn del sidecar), `tauri-plugin-updater` (auto-update), `tauri-plugin-dialog` (prompt del updater).
- WebView2 en Windows / WKWebView en Mac / WebKitGTK en Linux (cero Chromium bundleado — el shell Rust pesa ~5MB).
- `@tauri-apps/cli` 2.x como devDep para invocar `tauri dev` / `tauri build` / `tauri signer`.

**Layout**:
```
packages/tauri/
├── package.json
├── Cargo.toml            (tauri + plugins shell/updater/dialog; perfil
│                          release: lto, opt-level=s, strip, panic=abort)
├── Cargo.lock            (versionado — es una crate binaria)
├── tauri.conf.json       (identifier, ventana, externalBin + resources,
│                          plugins.updater con pubkey + endpoint,
│                          security.csp estricta — ADR-033)
├── tauri.updater.conf.json  (overlay: createUpdaterArtifacts, solo release)
├── build.rs              (invoca tauri_build::build())
├── capabilities/default.json
├── icons/                (PNG, ICO, ICNS + iOS/Android/Windows Store)
├── scripts/{generate-icon-source.py, source.png}
├── binaries/             (gitignored salvo .gitkeep)
│   ├── auto-exit-server-<triple>[.exe]   copia del runtime `bun`
│   └── server-app/       server desplegado (src + drizzle + node_modules)
├── src/
│   ├── main.rs           (entry con #![windows_subsystem="windows"] release)
│   └── lib.rs            (Builder: registra plugins + confirm_fix_plugin,
│                          setup() spawnea el sidecar; check_for_updates()
│                          es opt-in — ADR-033; RunEvent::Exit mata el
│                          sidecar)
├── target/               (build artifacts Rust — gitignored)
└── gen/                  (assets generados por Tauri — gitignored)
```

**Estado**: F4.1 (shell + sidecar + static export + iconos) y F4.2 (instalador funcional + auto-update) completas. `pnpm tauri:dev` itera con hot-reload; `pnpm tauri:build` produce `.msi` + `.exe` NSIS; `pnpm tauri:release` añade los artefactos firmados del updater. El sidecar es el runtime `bun` ejecutando `server-app/` — ver [ADR-031](DECISIONS.md) (por qué no `bun --compile`). La app puede comprobar actualizaciones al arrancar si el usuario activa el opt-in en `/settings` ([ADR-032](DECISIONS.md), [ADR-033](DECISIONS.md)); proceso de release en [RELEASING.md](RELEASING.md). Requiere Rust toolchain + Bun + (en Windows) MSVC Build Tools en la máquina de dev.

## Contrato `ProtocolAdapter`

```ts
interface ProtocolAdapter {
  readonly name: string;          // "orca", "meteora", ...
  readonly displayName: string;   // "Orca Whirlpools", ...

  // Schema + setup
  getConfigSchema(): ConfigSchema;
  setupRpc(common: BaseReadOnlyConfig): Promise<void>;
  // `rawSecret` opcional: adapters cuyo SDK firma con `Keypair` de
  // web3.js v1 (Meteora) lo necesitan; los que firman con `KeyPairSigner`
  // de kit (Orca) lo ignoran. F6.2.b + ADR-024.
  attachWallet(wallet: KeyPairSigner, rawSecret?: Uint8Array): void;

  // Discovery (read-only; solo requiere setupRpc)
  listOwnedPositions(owner: string): Promise<PositionRef[]>;
  getPositionSummary(ref: PositionRef): Promise<PositionSummary>;
  getPriceHistory?(ref: PositionRef, window: PriceWindow): Promise<PricePoint[]>;

  // CLI-style lifecycle (compat con packages/cli)
  loadProtocolConfig(env: NodeJS.ProcessEnv): unknown;
  init(common: BaseConfig, protocolConfig: unknown, wallet: KeyPairSigner, rawSecret?: Uint8Array): Promise<void>;
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
├── wallet.json                (gitignored)
├── README.md
├── SECURITY.md
├── CONTRIBUTING.md
├── docs/
│   ├── TODO.md
│   ├── DECISIONS.md
│   ├── ARCHITECTURE.md
│   ├── TESTING.md
│   └── RELEASING.md
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
    │   │       └── meteora/{adapter,config,README.md}
    ├── cli/                   (entry CLI, .env-based)
    │   ├── package.json       (name: @solana-auto-exit/cli)
    │   └── src/main.ts
    ├── server/                (backend tRPC + SQLite)
    │   ├── package.json       (name: @solana-auto-exit/server)
    │   ├── drizzle.config.ts
    │   ├── drizzle/           (migraciones SQL; bundled como resource en Tauri)
    │   ├── data/              (gitignored: DB + wallet vault en runtime dev)
    │   ├── scripts/build-binary.ts  (cross-platform bun build invoker)
    │   └── src/
    │       ├── main.ts
    │       ├── db/{schema,client}.ts
    │       ├── wallet/{vault,import}.ts
    │       ├── tasks/{manager,types,buffer,verify}.ts
    │       ├── security/{rpc-url,unlock-limiter}.ts  (defense-in-depth guards)
    │       └── trpc/
    │           ├── {init,context,router}.ts
    │           └── routers/{wallet,positions,tasks,settings}.ts
    ├── web/                   (frontend Next.js)
    │   ├── package.json       (name: @solana-auto-exit/web)
    │   ├── next.config.ts     (opt-in static export con TAURI_BUILD=1)
    │   ├── postcss.config.mjs
    │   ├── tsconfig.json
    │   └── src/
    │       ├── app/
    │       │   ├── layout.tsx + page.tsx + globals.css
    │       │   ├── positions/[mint]/{page.tsx, client.tsx}  (server shim + client)
    │       │   ├── tasks/[id]/{page.tsx, client.tsx}        (server shim + client)
    │       │   ├── wallet/, settings/, docs/
    │       ├── components/
    │       ├── i18n/{en,es,context,LangToggle}.ts
    │       └── lib/{trpc,format,tokens,constants,status}.ts
    └── tauri/                 (desktop shell — F4.1 + F4.2)
        ├── package.json       (name: @solana-auto-exit/tauri)
        ├── Cargo.toml         (tauri + plugins shell/updater/dialog)
        ├── Cargo.lock         (versionado — crate binaria)
        ├── tauri.conf.json    (externalBin + resources + plugins.updater)
        ├── tauri.updater.conf.json  (overlay createUpdaterArtifacts)
        ├── build.rs           (invoca tauri_build::build())
        ├── capabilities/default.json  (shell:allow-spawn restringido al sidecar)
        ├── icons/             (PNG, ICO, ICNS + iOS + Android + Windows Store)
        ├── binaries/          (gitignored: runtime bun + server-app desplegado)
        ├── scripts/{generate-icon-source.py, source.png}
        └── src/{main,lib}.rs  (entry + Builder: spawn sidecar + updater + cleanup)
```

Notas sobre el layout actual:
- `packages/server/src/security/` — guards de defense-in-depth (SSRF + brute-force unlock) añadidos en el sprint pre-public. Ver ADR-026/027 + entradas de PROGRESS.
- `packages/web/src/app/{positions,tasks}/[*]/{page.tsx, client.tsx}` — split en Server Component shim + Client Component para soportar Next.js static export; la navegación al detalle va por query string (`lib/routes.ts`). Ver [ADR-030](DECISIONS.md), [ADR-035](DECISIONS.md).
- `packages/tauri/{binaries, capabilities, scripts}` — infraestructura del sidecar (F4.1 + F4.2). `binaries/.gitkeep` versionado; el contenido (runtime `bun` + `server-app/`) gitignored, lo genera `build-binary.ts`.
- Archivos local-only (no en repo, gitignored): `CLAUDE.md` (índice personal), `docs/PROGRESS.md` (bitácora), `docs/sessions/` (notas de sesión).

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
6. Si hubo decisiones de diseño relevantes, añadir un ADR en `DECISIONS.md`.

La UI lo recogerá automáticamente cuando llamen `positions.configSchema` con el nuevo nombre de protocolo — el form se renderiza desde el schema declarado, sin tocar código del frontend.

## Restricciones operativas

- Por defecto **todo apunta a devnet** y `DRY_RUN=true`.
- Mainnet en vivo requiere `NETWORK=mainnet` + `DRY_RUN=false` + `ALLOW_MAINNET_LIVE=true` (ver [ADR-006](DECISIONS.md)). El gate también aplicará a la UI cuando se habilite (F4).
- Servidores bindean a `127.0.0.1` por defecto (ver [ADR-016](DECISIONS.md)). Para 24/7 vía VPS, usar Tailscale o Cloudflare Tunnel, **nunca abrir puertos a internet**.
- `wallet.json`, `.env`, `packages/server/data/`, `.next/`, y los directorios de tooling local están en `.gitignore`. Verificar con `git status` antes de cada commit.
- TypeScript estricto: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
