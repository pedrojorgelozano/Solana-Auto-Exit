# Auto-Exit · Solana

Self-hosted auto-exit bot for concentrated-liquidity positions on Solana. Watches Orca and Meteora pools every few seconds and closes a position when price hits your take-profit or stop-loss. Optionally swaps the proceeds to a stable. Runs locally on your machine, signs with a wallet you control.

No custody, no SaaS, no API keys to a service — your machine, your key.

---

## ⚠️ Disclaimer · use at your own risk

**This software is provided "as is", without warranty of any kind. You install, configure and use it entirely at your own risk.** By downloading, installing or running it, you accept full responsibility for any consequences — including the partial or total loss of the funds it manages.

- **No warranty.** Bugs may exist, prices may move unexpectedly, RPC endpoints may misbehave, on-chain protocols may change, and your transactions may fail or settle at a worse price than quoted.
- **Not financial advice.** Take-profit thresholds, stop-loss thresholds, slippage tolerances, time buffers, RPC endpoints, network defaults — every parameter the tool exposes — are yours to choose. The author is not a financial advisor.
- **You may lose money.** DeFi involves substantial risk. Do not commit funds you cannot afford to lose.
- **You are responsible** for the security of the machine where the tool runs, the strength of your passphrase, the RPC endpoint you point it at, the parameters you configure, and compliance with applicable laws in your jurisdiction.
- **Limitation of liability.** To the maximum extent permitted by applicable law, the author shall not be liable for any direct, indirect, incidental, consequential or special damages arising out of or related to the use of, or inability to use, this software.

If you do not agree, do not install or use it. The full plain-English disclaimer is rendered in-app at `/docs/disclaimer` and lives in [`packages/web/src/app/docs/disclaimer/page.tsx`](packages/web/src/app/docs/disclaimer/page.tsx).

---

## Status

| Surface | State |
|---|---|
| Web UI (Next.js 15 + Tailwind 4 + tRPC) | ✅ Wallet onboarding, position list, configure TP/SL, live dashboard, settings, in-app docs |
| Backend (Hono + tRPC + Drizzle/SQLite) | ✅ Persistent multi-position, encrypted vault, history events, on-chain verification |
| Orca Whirlpools adapter (SDK v8) | ✅ Close + optional same-pool exit swap. Validated on-chain on devnet + mainnet. |
| Meteora DLMM adapter | ✅ Close + optional swap-to-exit-token. Same shape as Orca. |
| Result verification (`getTransaction` parse) | ✅ Quoted vs actual + diff %, surfaced in receipts and `/tasks/[id]` timeline |
| Time buffer per trigger (TP/SL) | ✅ Sustained-price requirement before firing the close (ADR-025) |
| Settings persisted (RPC, slippage, poll) | ✅ Editable via `/settings`, per-network RPC canonicals |
| Mainnet default + UI gate | ✅ Mainnet is default; switching to TEST/REAL is one click with two-step confirmation (ADR-026 + ADR-027) |
| Light cuaderno UI + EN/ES toggle | ✅ Crema + terracota + Fraunces / Source Serif. Spanish translation toggleable from the header. |
| Docs in-app (`/docs`) | ✅ Seven editorial articles including the disclaimer |
| Tauri desktop installer (Win/Mac/Linux) | ✅ `tauri build` produces `.msi` / NSIS `.exe` installers with a Bun-runtime sidecar; opt-in auto-update via GitHub Releases (ADR-031, ADR-032, ADR-033). Build needs Bun + Rust + OS build tools. |
| Automated tests | ✅ 53 baseline (Vitest) covering security guards + task lifecycle. Coverage gaps documented in [`docs/TESTING.md`](docs/TESTING.md) |
| CI (typecheck + tests + sidecar smoke + gitleaks) | ✅ GitHub Actions on every push/PR to `main` |

## Quick start (web UI, devnet)

Requirements: Node ≥ 22, pnpm (`npm i -g pnpm`), `build-essential` + `python3` on Linux/WSL for the `better-sqlite3` native compile.

```bash
git clone https://github.com/pedrojorgelozano/Solana-Auto-Exit.git
cd Solana-Auto-Exit
pnpm install
```

Run the backend and the web UI in two terminals:

```bash
pnpm dev:server   # backend on http://127.0.0.1:7777
pnpm dev:web      # web UI on http://127.0.0.1:3000
```

Open <http://127.0.0.1:3000>. The home screen walks you through three steps:

1. **Set up the bot wallet** — generate fresh on this machine, or import the private key of a dedicated operational ("hot") account. Three honest paths in the modal; see `/docs/bot-wallet` for the trade-offs.
2. **Fund and stock the wallet** — send SOL (for fees) + tokens; open LP positions from the bot account on Orca, or transfer an existing position NFT to it.
3. **Configure an auto-exit** — set a take-profit price, a stop-loss price, or both. Optionally pick an exit token for the post-close swap.

Once it's armed, the bot polls the pool price and closes when one of your triggers crosses. Walk away.

## Quick start (Docker)

For a personal "production" setup that restarts with the machine:

```bash
docker compose up -d --build      # ~2 min first time (native build of better-sqlite3)
docker compose logs -f            # tail logs
docker compose down               # stop
```

The container:

- Binds **only on `127.0.0.1:7777`** of the host — never on `0.0.0.0`. Verify with `netstat`.
- Persists SQLite + encrypted vault in `./packages/server/data/` (volume mounted to the host).
- Restarts automatically (`unless-stopped`) on host reboot or container crash.

Today the Docker image bundles only the backend. Run `pnpm dev:web` separately, or build the Tauri desktop bundle (next section) which packages both.

## Quick start (Tauri desktop)

**Just want to use it?** Download the installer from the [latest release](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases/latest) — step-by-step instructions (download verification, the SmartScreen warning, first launch) in [`docs/INSTALL.md`](docs/INSTALL.md). The rest of this section is for building from source.

Building the desktop installer locally requires three toolchains beyond Node + pnpm:

- **Bun** — the desktop sidecar *is* the Bun runtime; it ships the deployed server and runs it.
  - Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`
  - macOS / Linux: `curl -fsSL https://bun.sh/install | bash`
- **Rust** stable — compiles the Tauri shell. Install via [rustup.rs](https://rustup.rs/).
- **OS-specific build deps** — Windows: Visual Studio Build Tools 2022 with "Desktop development with C++" + Windows 10/11 SDK. macOS: Xcode CLT (`xcode-select --install`). Linux: webkit2gtk-4.1, libsoup-3, libayatana-appindicator3, build-essential.

Once installed:

```bash
pnpm tauri:dev      # iterate with hot-reload
pnpm tauri:build    # produce installers in packages/tauri/target/release/bundle/
pnpm tauri:release  # release build with signed auto-update artifacts
```

`pnpm tauri:build` static-exports the Next frontend, deploys the server with its `node_modules` via `pnpm deploy`, copies the Bun runtime as the sidecar, and bundles everything into the platform installer (`.msi` + NSIS `.exe` on Windows, `.dmg` on macOS, `.AppImage`/`.deb` on Linux). The server is **not** compiled into a single binary — `bun --compile` can't package the project's WASM/native deps; see [ADR-031](docs/DECISIONS.md).

Builds are **not** OS-code-signed (Apple Developer ID and Microsoft EV certificates are paid). First launch shows a Gatekeeper / SmartScreen warning the user accepts once. The app can check for updates through a self-managed signing keypair + GitHub Releases — independent of OS code-signing — but this check is **opt-in and off by default** (it reaches out to GitHub, so you enable it in `/settings`); see [ADR-032](docs/DECISIONS.md), [ADR-033](docs/DECISIONS.md) and [`docs/RELEASING.md`](docs/RELEASING.md).

## Quick start (CLI, legacy)

Bare-bones path for smoke tests and devnet experiments without the web UI. One position at a time, single trigger (TP **or** SL, not both), no time buffer, `.env`-based config:

```bash
cp .env.example .env       # edit the values
npx tsx scripts/gen-wallet.ts    # if you don't have a wallet
pnpm start                  # CLI watcher
```

The CLI predates F1 (multi-position, TP+SL simultaneous, time buffer per ADR-025). For real use, **go through the web UI** — it's the canonical path. The CLI remains supported for adapter probes and one-shot tests against a single fixed trigger.

See [`docs/TESTING.md`](docs/TESTING.md) for the validated scenarios with on-chain tx hashes.

## Architecture

Three-package pnpm workspace:

- **`packages/engine`** — protocol-agnostic core (loop, retry, runner, `ProtocolAdapter` contract). Orca adapter lives here.
- **`packages/server`** — Hono + tRPC + Drizzle/SQLite backend. Persists tasks, history, settings, and the encrypted wallet vault. Binds `127.0.0.1` only.
- **`packages/web`** — Next.js 15 (App Router) UI. Talks to the server over tRPC. Includes the in-app `/docs` editorial pages.

Plus `packages/cli` (thin env-based consumer of the engine) and `scripts/` (utilities, probes).

Full design: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). All decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Documentation

For end users (recommended — start here):

| Article | What it covers |
|---|---|
| `/docs/getting-started` | The three-step walkthrough end to end. |
| `/docs/bot-wallet` | Three paths to provide a key, blast radius explained precisely. |
| `/docs/auto-exit` | TP/SL triggers, time buffer, slippage, exit token, what happens when a close fails. |
| `/docs/operational` | Restarts, lock/unlock, error handling, activity timeline, backups. |
| `/docs/security` | Threat model, encryption choices, mainnet gate, what can still go wrong. |
| `/docs/faq` | Recurring questions (why not Phantom-style, mainnet, congestion, etc.). |
| `/docs/disclaimer` | **The plain-English version of the disclaimer above. Read this before committing real funds.** |

For contributors (developer-facing, in the repo):

- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADRs (34 architectural decisions).
- [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md) — network-egress audit: scope, method, findings, verdict.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layered architecture in detail.
- [`docs/TESTING.md`](docs/TESTING.md) — what's validated, with on-chain tx hashes for the close + swap flow.
- [`docs/TODO.md`](docs/TODO.md) — open work and backlog.
- [`docs/RELEASING.md`](docs/RELEASING.md) — desktop release process: signing keypair, auto-update artifacts, GitHub Release.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — what's welcome, what isn't, dev setup.

## Security

- Localhost bind by default (ADR-016). Nothing on the LAN can reach the API.
- Wallet key encrypted at rest with `scrypt(N=32768)` + `AES-256-GCM` (Node `node:crypto`, zero deps).
- The app accepts **per-account private keys only** — never seed phrases. The "blast radius" of importing a key is bounded to that one Solana address; other accounts in your Phantom/Backpack are unaffected.
- Switching from test (devnet) to real (mainnet) is one click + two-step UI confirmation (checkbox + danger button). The legacy `ALLOW_MAINNET_LIVE` env var has become opt-OUT (set it to `false` to harden the CLI path against unattended mainnet runs). Full model: ADR-026 + ADR-027.
- Nothing leaves your machine but calls to the RPC you configured — no telemetry, no analytics, no external assets, and auto-update is opt-in. Verified by a network-egress audit ([`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md)).

Full threat model and hardening checklist in [`SECURITY.md`](SECURITY.md).

## Stack

- **Runtime**: Node 22, TypeScript strict, `tsx` for dev, `tsc --noEmit` for the typecheck gate.
- **Solana**: `@orca-so/whirlpools@^8` + `@solana/kit@^5` (pinned to v5 per ADR-002).
- **Backend**: Hono + `@hono/trpc-server` + tRPC v11 + Drizzle ORM + `better-sqlite3` + zod.
- **Frontend**: Next.js 15 App Router, Tailwind 4 (CSS-first, no `tailwind.config.ts`), React 19, TanStack Query 5, `@trpc/react-query`. Editorial UI direction in ADR-017.
- **Cipher**: scrypt + AES-256-GCM via `node:crypto`. Zero external crypto deps (ADR-012).

## License

MIT — see [`LICENSE`](LICENSE).
