---
name: Bug report
about: Something broke or is behaving differently than the docs say
labels: bug
---

> ⚠️ **For security vulnerabilities, do NOT open a public issue.** Email pedrojorge.lozano@gmail.com or use GitHub Security advisories. See `SECURITY.md`.

## What happened

A clear, concrete description. One issue per bug; if you found three, please file three.

## Steps to reproduce

1. ...
2. ...
3. ...

## Expected vs actual

- **Expected**: ...
- **Actual**: ...

## Environment

- OS + version (e.g. macOS 15.1, Windows 11 26200, Ubuntu 24.04 / WSL):
- Node version (`node --version`):
- pnpm version (`pnpm --version`):
- Network you were operating on: `devnet` / `mainnet`
- Commit hash you're on (`git rev-parse HEAD`):
- Were you running via `pnpm dev:*` (clone) or a built Tauri bundle (when those exist)?

## Logs

Paste server logs (`pnpm dev:server` output) and/or browser console errors. **Redact any wallet address, transaction signature, or private RPC URL** before pasting if you don't want them public.

```
<paste here>
```

## Additional context

Screenshots of the UI, on-chain tx hashes (if relevant and public), or any hypothesis you have about the cause.
