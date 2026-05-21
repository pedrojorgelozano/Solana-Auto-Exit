# Auto-Exit · Solana

Self-hosted auto-exit bot for concentrated-liquidity positions on Solana. Watches Orca (and soon Meteora) pools every few seconds and closes a position when price hits your take-profit or stop-loss. Optionally swaps the proceeds to a stable. Runs locally on your machine, signs with a wallet you control.

No custody, no SaaS, no API keys to a service — your machine, your key.

## Status

| Surface | State |
|---|---|
| Web UI (Next.js 15 + Tailwind 4 + tRPC) | ✅ Wallet onboarding, position list, configure TP/SL, live dashboard, settings, in-app docs |
| Backend (Hono + tRPC + Drizzle/SQLite) | ✅ Persistent multi-position, encrypted vault, history events, on-chain verification |
| Orca Whirlpools adapter (SDK v8) | ✅ Close + optional same-pool exit swap. Validated on-chain on devnet. |
| Result verification (`getTransaction` parse) | ✅ Quoted vs actual + diff %, surfaced in receipts and `/tasks/[id]` timeline |
| Settings persisted (RPC, slippage, poll) | ✅ Editable via `/settings` |
| Docs in-app (`/docs`) | ✅ Six editorial articles |
| Meteora DLMM adapter | ⏳ Stub (F6) |
| Tauri desktop installer (Win/Mac/Linux) | ⏳ F4 |
| Mainnet UI gate | 🔒 Locked until F4 + visual audit (ADR-006) |
| Automated tests | ❌ Backlog |

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

Today the Docker image bundles only the backend. Run `pnpm dev:web` separately, or wait for F4 (Tauri) which packages both as a single desktop app.

## Quick start (CLI, advanced)

Power-user path for testing without the web UI. One position at a time, `.env`-based config:

```bash
cp .env.example .env       # edit the values
npx tsx scripts/gen-wallet.ts    # if you don't have a wallet
pnpm start                  # CLI watcher
```

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
| `/docs/auto-exit` | TP/SL triggers, slippage, exit token, simulation mode. |
| `/docs/operational` | Restarts, lock/unlock, error handling, backups. |
| `/docs/security` | Threat model, encryption choices, what can still go wrong. |
| `/docs/faq` | Recurring questions (why not Phantom-style, mainnet, congestion, etc.). |

For contributors (developer-facing, in the repo):

- [`docs/PROGRESS.md`](docs/PROGRESS.md) — session-by-session log.
- [`docs/TODO.md`](docs/TODO.md) — open work and backlog.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADRs (21+ architectural decisions).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layered architecture in detail.
- [`docs/TESTING.md`](docs/TESTING.md) — what's validated, with on-chain tx hashes for the close + swap flow.

## Security

- Localhost bind by default (ADR-016). Nothing on the LAN can reach the API.
- Wallet key encrypted at rest with `scrypt(N=32768)` + `AES-256-GCM` (Node `node:crypto`, zero deps).
- The app accepts **per-account private keys only** — never seed phrases. The "blast radius" of importing a key is bounded to that one Solana address; other accounts in your Phantom/Backpack are unaffected.
- Mainnet operations are gated by `ALLOW_MAINNET_LIVE=true` (ADR-006) and not exposed in the UI until F4.

Full threat model and hardening checklist in [`SECURITY.md`](SECURITY.md).

## Stack

- **Runtime**: Node 22, TypeScript strict, `tsx` for dev, `tsc --noEmit` for the typecheck gate.
- **Solana**: `@orca-so/whirlpools@^8` + `@solana/kit@^5` (pinned to v5 per ADR-002).
- **Backend**: Hono + `@hono/trpc-server` + tRPC v11 + Drizzle ORM + `better-sqlite3` + zod.
- **Frontend**: Next.js 15 App Router, Tailwind 4 (CSS-first, no `tailwind.config.ts`), React 19, TanStack Query 5, `@trpc/react-query`. Editorial UI direction in ADR-017.
- **Cipher**: scrypt + AES-256-GCM via `node:crypto`. Zero external crypto deps (ADR-012).

## License

MIT — see [`LICENSE`](LICENSE).
