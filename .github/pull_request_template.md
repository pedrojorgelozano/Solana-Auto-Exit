<!-- For security vulnerabilities, do NOT open a public PR. Email or use GitHub Security advisories. See SECURITY.md. -->

## What

Brief description of the change.

## Why

What problem does this solve? Link the issue or ADR if there is one.

## How to verify

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Manual steps (if any): ...
- [ ] On-chain txs (if you ran a real close/swap): ...

## Risk

- [ ] Touches the signing path (`WalletVault`, `executeClose`, adapter `closePosition`/`swapToExit`)
- [ ] Touches the watcher state machine (`TaskManager`, `evalBuffer`)
- [ ] Changes a tRPC procedure signature (breaking client compat)
- [ ] Changes a `docs/DECISIONS.md` invariant — new ADR included
- [ ] None of the above (low-risk: typo, doc, test-only)

## Out of scope

What this PR explicitly does NOT cover (so reviewers don't expect it).
