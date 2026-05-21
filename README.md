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
| Tauri desktop installer (Win/Mac/Linux) | ⏳ F4 (scaffolding done) |
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

- [`docs/PROGRESS.md`](docs/PROGRESS.md) — session-by-session log.
- [`docs/TODO.md`](docs/TODO.md) — open work and backlog.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADRs (21+ architectural decisions).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layered architecture in detail.
- [`docs/TESTING.md`](docs/TESTING.md) — what's validated, with on-chain tx hashes for the close + swap flow.

## Security

- Localhost bind by default (ADR-016). Nothing on the LAN can reach the API.
- Wallet key encrypted at rest with `scrypt(N=32768)` + `AES-256-GCM` (Node `node:crypto`, zero deps).
- The app accepts **per-account private keys only** — never seed phrases. The "blast radius" of importing a key is bounded to that one Solana address; other accounts in your Phantom/Backpack are unaffected.
- Switching from test (devnet) to real (mainnet) is one click + two-step UI confirmation (checkbox + danger button). The legacy `ALLOW_MAINNET_LIVE` env var has become opt-OUT (set it to `false` to harden the CLI path against unattended mainnet runs). Full model: ADR-026 + ADR-027.

Full threat model and hardening checklist in [`SECURITY.md`](SECURITY.md).

## Stack

- **Runtime**: Node 22, TypeScript strict, `tsx` for dev, `tsc --noEmit` for the typecheck gate.
- **Solana**: `@orca-so/whirlpools@^8` + `@solana/kit@^5` (pinned to v5 per ADR-002).
- **Backend**: Hono + `@hono/trpc-server` + tRPC v11 + Drizzle ORM + `better-sqlite3` + zod.
- **Frontend**: Next.js 15 App Router, Tailwind 4 (CSS-first, no `tailwind.config.ts`), React 19, TanStack Query 5, `@trpc/react-query`. Editorial UI direction in ADR-017.
- **Cipher**: scrypt + AES-256-GCM via `node:crypto`. Zero external crypto deps (ADR-012).

## License

MIT — see [`LICENSE`](LICENSE).
