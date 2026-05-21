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
| Seed-phrase exposure of an entire wallet | The app accepts per-account private keys only (64-byte base58 or 64-int JSON array). Seed phrases are **never** accepted, so importing a key is scoped to exactly one Solana address. |
| Multi-instance interference | One TaskManager per server process; active tasks are paused at boot and require manual resume after unlock. |

### What Is *Not* Defended Against

- **Malware on your machine.** Anything that can read this process's memory while the vault is unlocked can extract the key. Lock the vault when not actively monitoring.
- **Weak passphrases.** scrypt slows offline cracking but does not eliminate it. Use 16+ random characters from a password manager.
- **Malicious RPC.** Pool prices are read from whatever RPC URL you configure. A compromised RPC could feed wrong prices to mis-trigger an exit. Use an RPC you trust — your own node, Helius, Triton, QuickNode, etc. The public devnet/mainnet endpoints are not authenticated and are out of your control.
- **Third-party dependencies.** Supply-chain attacks on `@orca-so/whirlpools`, `@solana/kit`, `better-sqlite3`, or any transitive dep are not in this project's threat model. Audit the lockfile and pin commits if you need this guarantee.
- **Phantom / Backpack / hardware wallet UIs.** If you import the bot wallet key into Phantom/Backpack as a second account and that wallet UI is compromised, the same key is exposed there. This is true for any key managed by both a wallet UI and this tool.

## Hardening Checklist

Before running with anything you would miss:

1. Strong passphrase from a password manager (≥ 16 random chars).
2. Full-disk encryption enabled on the host.
3. Dedicated **hot** Solana account for the bot — never the account where you store cold holdings.
4. Private RPC URL configured in `/settings`, not the public endpoint.
5. Lock the vault from the wallet page whenever you're not actively monitoring.
6. If exposing the server beyond localhost, use Tailscale or Cloudflare Tunnel — never open the port to the internet.
7. Keep your OS, Node, and Docker up to date.

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
