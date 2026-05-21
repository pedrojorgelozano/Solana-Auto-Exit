# Contributing

Thanks for considering a contribution. This project is small and opinionated, so reading this first will save us both time.

## Before you open an issue or PR

1. **Security issues do NOT go in public issues.** Email `pedrojorge.lozano@gmail.com` or use [GitHub Security advisories](../../security/advisories/new). See [`SECURITY.md`](SECURITY.md) for the threat model and what is / isn't in scope.
2. **Read [`docs/DECISIONS.md`](docs/DECISIONS.md).** Most "why doesn't it do X" questions are answered in the ADRs (currently 27+). If a PR contradicts an ADR, the PR description must propose a new ADR that supersedes it.
3. **Read the in-app `/docs` articles** (or [`packages/web/src/app/docs/`](packages/web/src/app/docs)). They cover the threat model in plain English and explain why some obvious-looking features (Phantom-style sign-and-forget, seed-phrase import, etc.) are deliberately absent.

## What kinds of contributions are welcome

- **Bug fixes** with a failing test that demonstrates the bug.
- **New protocol adapters** (Raydium CL, Kamino, etc.) following the `ProtocolAdapter` contract in [`packages/engine/src/protocols/types.ts`](packages/engine/src/protocols/types.ts) and the patterns in the Orca and Meteora adapters.
- **Test coverage** for areas that are still bare (the existing suite is a baseline; vault, full TaskManager lifecycle, and adapters are still uncovered).
- **Docs improvements**, especially the in-app `/docs` articles.

## What is NOT welcome

- **Adding a "save passphrase on disk" or "auto-unlock at boot" option.** This contradicts the threat model in [`SECURITY.md`](SECURITY.md). The only way to start a watcher is via an unlock that the human performs.
- **Adding telemetry, analytics, or "phone-home" anything.** This is a self-hosted tool by design.
- **Adding a "managed RPC" or "managed signing" feature.** The whole point is no custody.
- **Refactors without a concrete user-facing improvement.** Pure "cleanup" PRs without a problem statement are typically declined.
- **AI-generated PRs without manual review.** Tools are fine; submitting code you haven't read isn't.

## How to develop locally

```bash
git clone <repo>
cd <repo>
pnpm install
pnpm dev:server   # terminal 1: backend on 127.0.0.1:7777
pnpm dev:web      # terminal 2: web UI on 127.0.0.1:3000
```

Requirements: Node ≥ 22, pnpm ≥ 11, `build-essential` + `python3` on Linux/WSL for `better-sqlite3` native compile.

## Before you push

```bash
pnpm typecheck   # must pass
pnpm test        # must pass
```

CI runs both on every PR. PRs that don't pass CI are not reviewed.

If you touched the engine or server, also run `scripts/probe-*.ts` against devnet as a sanity check — see [`docs/TESTING.md`](docs/TESTING.md).

## Commit style

- Imperative subject ≤ 72 chars: `fix(tasks): SolscanLink network-aware`.
- Prefix with the scope when relevant: `fix(server)`, `feat(adapter/meteora)`, `docs`, `test`, `security`.
- One logical change per commit. If you find a tangential bug, fix it in a separate commit.
- Reference ADRs or issues when relevant: `Closes #42`, `Implements ADR-027`.

## PR template

When opening a PR, please include:

- **What** changed and **why** (the "why" matters more).
- **How to verify** (which tests, which manual steps, which on-chain hashes if applicable).
- **Risk** of the change (does it touch the signing path, the vault, the watcher state machine?).
- **Out of scope** — what this PR explicitly does NOT do, to set reviewer expectations.

## License

By contributing you agree that your contribution is licensed under the MIT License (see [`LICENSE`](LICENSE)).
