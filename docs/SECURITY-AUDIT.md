# Security Audit — Network Egress

**Date:** 2026-05-22
**Scope:** Outbound network behaviour of every package — `engine`, `server`, `web`, `cli`, `tauri`.
**Type:** Internal source review by the project maintainer. This is **not** a third-party professional audit.
**Result:** **PASS** — no data exfiltration found. Three hardening fixes applied (see below).

## Why this audit

Auto-Exit holds a Solana private key on disk and is run by people on hardened machines — VPNs, egress firewalls, locked-down networks. A tool like this must not send anything off the machine that the user did not explicitly ask for. This review verifies that claim and records *what* was checked, so a reader does not have to take it on faith.

## What was reviewed

- Every outbound network call (`fetch`, HTTP clients, raw sockets) across `packages/{engine,server,web,cli,tauri}`.
- The dependency tree for telemetry, analytics, crash-reporting or any "phone-home" behaviour.
- Web assets — fonts, scripts, images — for any external origin.
- The Tauri desktop webview's Content-Security-Policy.
- Application logging — whether the private key, the vault passphrase, or the decrypted vault contents are ever written to a log or included in a network payload.

**Out of scope:** supply-chain integrity of third-party dependencies (covered by the threat model in [`SECURITY.md`](../SECURITY.md)), and the correctness or trustworthiness of the Solana RPC endpoint the user configures.

## Method

Static source review: pattern search across the monorepo for network primitives and known telemetry SDKs; inspection of every `package.json`, `next.config.ts`, the Tauri `tauri.conf.json`, and the dependency lockfile; manual reading of the modules that legitimately do make network calls (the RPC adapters and the desktop updater).

## Findings

### 1. Outbound network calls — PASS

The only network traffic in normal operation is the Solana RPC. Its URL is always user-configured in `/settings` and validated by `assertSafeRpcUrl` (the SSRF guard). There are no hardcoded third-party endpoints anywhere in the codebase. The one network call *not* initiated by the user was the desktop auto-update check — addressed by fix #3.

### 2. Telemetry & third-party services — PASS (one fix)

No analytics SDK, no crash reporter, no usage beacon in any package. **Finding:** Next.js emits anonymous build telemetry by default. **Fixed** — see #2.

### 3. Web assets — PASS

Fonts are self-hosted by `next/font` at build time. No CDN, no Google Fonts, no third-party `<script>` tags. The build output carries its own assets.

### 4. Tauri webview CSP — PASS (one fix)

**Finding:** `app.security.csp` in `tauri.conf.json` was `null` — the desktop webview ran with no Content-Security-Policy at all. **Fixed** — see #1.

### 5. Sensitive data in logs — PASS

The private key, the vault passphrase, and the decrypted vault contents are never written to a log file nor included in any network payload. The sidecar log (`sidecar.log`, in the app data directory) carries only server lifecycle lines.

## Fixes applied

| # | Fix | Where | Commit |
|---|---|---|---|
| 1 | Strict Content-Security-Policy on the Tauri webview — `connect-src` limited to `'self'`, `ipc:` and the local sidecar; `object-src` / `frame-src` set to `'none'` | `packages/tauri/tauri.conf.json` | `198e0dd` |
| 2 | Next.js build telemetry disabled (`NEXT_TELEMETRY_DISABLED=1`) | `packages/web/package.json` | `198e0dd` |
| 3 | Auto-update check made **opt-in, off by default** — it reaches GitHub Releases, so it now only runs if the user enables it in `/settings` | `packages/tauri/src/lib.rs`, settings router | `9f7b8a5` |

Decision record: [ADR-033](DECISIONS.md). User-facing summary: [`SECURITY.md` § Network Egress](../SECURITY.md).

## Verdict

The application does not exfiltrate data. In normal use it makes exactly one kind of outbound connection — to the Solana RPC URL the user chose. With the auto-update opt-in left off (the default), the app makes no other outbound connection at all. On a hardened machine, nothing here should trip an egress filter except that RPC endpoint.

## Re-running this review

The checks above are static and repeatable: search the tree for network primitives and telemetry SDKs, inspect `package.json` / `next.config.ts` / `tauri.conf.json`, and read the modules that call the network. Re-run after any dependency bump or new feature that touches the network, and append a dated section to this file.
