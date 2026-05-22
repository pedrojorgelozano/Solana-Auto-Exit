# Security Policy

Auto-Exit is a self-hosted tool that holds a Solana private key on disk (encrypted) and uses it to sign close transactions autonomously. The threat model below describes what is and isn't defended against — read it before exposing the server beyond localhost, or before keeping more than throwaway funds in the bot wallet.

## Threat Model

### Assumed Operating Environment

- The machine running the server is under your control.
- The network the server listens on is private (default: `127.0.0.1` only).
- The filesystem can be read only by you (full-disk-encrypted laptop or single-user VPS).
- You picked a strong passphrase and stored it in a password manager.

If any of these assumptions don't hold, the defenses below offer less than they appear to.

### What Is Defended Against

| Threat | Defense |
|---|---|
| Remote network attacker reaching the API | Server binds `127.0.0.1` only by default. Docker maps the port localhost-only on the host. |
| Attacker reading the vault file at rest | `scrypt(N=32768, r=8, p=1)` KDF + AES-256-GCM cipher (Node `node:crypto`). |
| Attacker tampering with the vault file | GCM authentication tag fails the unlock, so silent garbage is impossible. |
| Brute-force of the vault passphrase via API | `wallet.unlock` is rate-limited: 5 failed attempts / 5 min in-memory sliding window, then 429 with cooldown. A successful unlock resets the counter. |
| SSRF via the configurable `rpcUrl` | `assertSafeRpcUrl` blocks loopback, cloud metadata endpoints (`169.254.x.x`), all-interfaces (`0.0.0.0`/`::`), IPv6 link-local, and non-http(s)/ws(s) schemes on both `settings.update` and `tasks.create`. LAN ranges (10/8, 172.16/12, 192.168/16) and Tailscale (100.64/10) remain allowed for power users. Escape hatch `ALLOW_LOOPBACK_RPC=true` for `solana-test-validator`. |
| Seed-phrase exposure of an entire wallet | The app accepts per-account private keys only (64-byte base58 or 64-int JSON array). Seed phrases are **never** accepted, so importing a key is scoped to exactly one Solana address. |
| Multi-instance interference | One TaskManager per server process; active tasks are paused at boot and require manual resume after unlock. |
| Accidental real-funds operation in test workflows | Mainnet vs devnet is a one-click toggle in `/settings`, but switching to REAL requires a two-step confirmation (checkbox + danger button) per ADR-026. Mainnet is the default network per ADR-027 — see `/docs/disclaimer`. |

### What Is *Not* Defended Against

- **Malware on your machine.** Anything that can read this process's memory while the vault is unlocked can extract the key. Lock the vault when not actively monitoring.
- **Weak passphrases.** scrypt slows offline cracking but does not eliminate it. Use 16+ random characters from a password manager.
- **Malicious RPC.** Pool prices are read from whatever RPC URL you configure. A compromised RPC could feed wrong prices to mis-trigger an exit. Use an RPC you trust — your own node, Helius, Triton, QuickNode, etc. The public devnet/mainnet endpoints are not authenticated and are out of your control.
- **Third-party dependencies.** Supply-chain attacks on `@orca-so/whirlpools`, `@solana/kit`, `better-sqlite3`, or any transitive dep are not in this project's threat model. Audit the lockfile and pin commits if you need this guarantee.
- **Phantom / Backpack / hardware wallet UIs.** If you import the bot wallet key into Phantom/Backpack as a second account and that wallet UI is compromised, the same key is exposed there. This is true for any key managed by both a wallet UI and this tool.

### Network Egress

The tool is built to stay quiet on the network. It makes **no outbound connections of its own**:

- **Solana RPC** is the only network traffic in normal operation, and it always goes to the URL *you* configure in `/settings`. Pick an RPC you trust.
- **No telemetry, no analytics.** There is no analytics SDK, no crash reporter, no usage beacon. Next.js build telemetry is disabled (`NEXT_TELEMETRY_DISABLED=1`).
- **No external assets.** Fonts are self-hosted at build time; there are no CDN, Google Fonts, or third-party script tags. The desktop webview runs under a strict Content-Security-Policy that limits `connect-src` to the local sidecar — an injected script cannot phone home.
- **Auto-update is opt-in.** The desktop app can check GitHub Releases for a new version, but that check is **off by default**; it only runs if you enable it in `/settings`. With it off, the app never contacts GitHub.

If you run on a hardened machine (VPN, egress firewall), nothing here should trip your filters except the RPC endpoint you chose. The full audit — scope, method, findings per area, verdict — is in [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md); the decisions it drove are recorded in [ADR-033](docs/DECISIONS.md).

## Hardening Checklist

Before running with anything you would miss:

1. Strong passphrase from a password manager (≥ 16 random chars).
2. Full-disk encryption enabled on the host.
3. Dedicated **hot** Solana account for the bot — never the account where you store cold holdings.
4. Private RPC URL configured in `/settings`, not the public endpoint.
5. Lock the vault from the wallet page whenever you're not actively monitoring.
6. If exposing the server beyond localhost, use Tailscale or Cloudflare Tunnel — never open the port to the internet.
7. Keep your OS, Node, and Docker up to date.
8. Read the in-app disclaimer at `/docs/disclaimer` — the project is provided "as is" with no warranty. You are responsible for the funds the bot manages.

## Pre-public Checklist (maintainers)

Before flipping the GitHub repo to public visibility (per ADR-009):

```bash
# Scan the full git history for secrets that may have slipped in.
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect --source=/repo --redact
```

If `gitleaks` flags anything (API keys, private keys, JSON wallets, `.env` content), **rotate first**, then rewrite the affected commits with `git filter-repo` before publishing. The repository's `.gitignore` already excludes `.env`, `wallet.json`, `*.vault`, and `packages/server/data/`, but the scan is the only way to verify nothing escaped before the rule was added.

## Reporting a Vulnerability

Report security issues privately. Do **not** open a public issue — crypto-project bugs become exploit blueprints in minutes.

- **Email**: pedrojorge.lozano@gmail.com
- **Once this repository is public on GitHub**: please use [GitHub Security advisories](../../security/advisories/new) (preferred).

Include reproduction steps, affected version (commit hash), and the impact you observe. Acknowledgement target: within 7 days.

## Scope

In scope:

- Code in this repository (engine, server, web, CLI).
- The wallet vault encryption format.
- The local HTTP / tRPC API surface.

Out of scope (please file with the respective project):

- Third-party SDK bugs (Orca, `@solana/kit`, Drizzle, Hono, Next.js).
- Solana RPC providers' availability or response correctness.
- Phantom, Backpack, Solflare, hardware wallet vendors.
- Hosting provider security.

## Disclosure Policy

For confirmed vulnerabilities, we aim to:

1. Acknowledge the report within 7 days.
2. Coordinate a fix and a disclosure timeline with the reporter.
3. Credit the reporter in the release notes (unless they prefer to remain anonymous).

For non-security bugs and feature requests, regular GitHub issues are the right venue.
