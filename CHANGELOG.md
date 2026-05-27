# Changelog

All notable changes to Auto-Exit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Installers and checksums for each release are on the [Releases page](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases).

## [Unreleased]

### Changed
- **Refreshed UI direction — "refined minimal dark"** (in branch, not yet merged to `main`). The whole visual layer has been redone: dark `#0b0d0f` surface with jade accent, Hanken Grotesk sans for body and headings (Newsreader italic for accents), Spline Sans Mono for numbers. The global header has been replaced by a left sidebar with brand + nav + server/wallet beacons. Dashboard, ledger and settings have been re-laid out per the new direction. **No functionality added or removed** — every flow you can do today still works the same. See [ADR-038](docs/DECISIONS.md), supersedes [ADR-017](docs/DECISIONS.md).
- **Auto-exit detail screen redesigned.** `/tasks/[id]` follows the new `auto-exit-detail.html` mockup: header with token-pair badges + protocol pill + status pill, hero panel with the live price (big mono) plus a **new visual price band** that draws the liquidity range as a jade-tinted zone with explicit min/max labels, stop-loss and take-profit flags below, and the live price as a glowing node. Below the hero: trigger cards in a 2-column grid (with distance bar and buffer footer), a position-holdings panel with a 2×2 grid (liquidity, pending fees, range status, estimated value computed in the quote token without an external oracle), a right-side sticky aside with Details (protocol / network / exit token / buffers / slippage / position mint), and a full-width Activity timeline with coloured nodes. Layout is `1fr 332px` on `lg+`, stacks on mobile.
- **Pages anchored to the sidebar.** All page roots (`/`, `/wallet`, `/tasks`, `/tasks/[id]`, `/positions/[mint]`, `/settings`, `/docs/*`, `error`, `not-found`) switched from `mx-auto` to `mr-auto`. On wide viewports the content used to centre inside the column-after-sidebar leaving a ~250 px hole between the sidebar and the content; now it hugs the sidebar with the overflow on the right, which feels more natural.
- **Typography scaled up for readability.** Body 15→17 px, eyebrows 11→13 px, t-h2 17→19 px, t-h3 15→17 px, t-h1 28-36→32-40 px. Inline small sizes across all components bumped one step up (`text-[10-12.5px]` → `text-[12-14px]`). Big numbers in the hero stay large (28–54 px). Targets older users who reported the previous scale as too small.
- **Number formatting: 2 decimals + English thousands separator.** Prices and triggers now show `22.38` instead of `22.3773` by default, with auto-bump to 4–8 decimals for very small numbers (BONK-style memes) so precision is not lost. Amounts ≥ 1,000 use the English thousands separator (`1,234.56`). Pool-range rates show as plain numbers (no currency suffix) following the Orca/Meteora convention; the hero anchors the denomination once with `1 SOL = X devUSDC`. Token amounts (liquidity, fees, estimated value) keep their symbol because they are actual amounts, not rates.
- **Lock-wallet moved out of the sidebar.** The button used to live at the foot of the sidebar where it invited a user to press it by default, but locking pauses every active auto-exit — which breaks the "set and forget" promise. Lock now lives only inside `/wallet` as a panel with explicit copy on what locking actually does, and a link to `/docs/security#hot-wallet-tradeoff` for the trade-off. The new section in `/docs/security` documents the hot-wallet posture honestly: the bot needs the key decrypted in RAM while operating, which is the same model Phantom and Backpack use while unlocked; the real mitigation is operational — *treat the bot wallet as a hot operational account, never your cold holdings*. See [ADR-039](docs/DECISIONS.md).

## [0.1.1] — 2026-05-27

Maintenance release. The Windows installer picks up two wallet-import UX fixes; the rest are infrastructure improvements (Docker self-hosted stack + hardening + multi-platform install docs) that don't change the installer behavior.

### Added
- **Self-hosted Docker stack** — `docker compose up` now serves both the server (:7777) and the web UI (:3000) from a single image. Both bind to `127.0.0.1`. Open `http://127.0.0.1:3000` in your browser. Targets Linux/Mac users who don't have a native installer yet; also works on Windows. See [ADR-036](docs/DECISIONS.md).
- **Run from source with pnpm** — a third install path (any OS) documented in [INSTALL.md](docs/INSTALL.md), intended for hardened hosts where Docker's container network clashes with strict firewall / kill-switch VPN rules, and for development.
- **Multi-platform install guide** — [INSTALL.md](docs/INSTALL.md) now covers Windows (native installer + Docker), macOS (Docker + source), and Linux (Docker + source), with prerequisites step-by-step, troubleshooting (Docker group + logout, DNS issues including hardened-network workarounds, pnpm not found), privacy notes for Docker Desktop telemetry.

### Security
- **Docker stack hardened** — six standard controls applied to both containers: non-root user (uid 1000), read-only root filesystem (with tmpfs for `/tmp`, `/home/node` and Next.js cache), all Linux capabilities dropped, `no-new-privileges`, memory/CPU limits, and HTTP healthchecks (web waits for the server to be healthy before starting). On Linux with a non-1000 host user, `./packages/server/data/` needs `chown -R 1000:1000` once; Docker Desktop on Windows/Mac handles it transparently. See [ADR-037](docs/DECISIONS.md).

### Changed
- **Wallet import errors are now actionable and non-leaking.** A bad keypair (Solana error #3704004, `PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY`) and non-base58 characters in the input (#8078012) used to surface as cryptic `Solana error #XXXXXXX; decode this error...` messages — and the latter leaked the offending value into the message. Now: the keypair error becomes a clear "the private key bytes do not form a valid keypair"; the base58 error names the offending characters with their Unicode code point and detects homoglyphs (Cyrillic letters that look identical to Latin ones — caused by browser auto-translation overwriting the DOM text). _This change is in the installer._

## [0.1.0] — 2026-05-22

First public release — a self-hosted desktop app that watches Orca and Meteora liquidity positions on Solana and closes them when price hits a take-profit or stop-loss.

### Added
- Take-profit and stop-loss auto-exits for **Orca Whirlpools** and **Meteora DLMM** positions, with optional swap-to-exit into a token of your choice.
- **Windows desktop app** — bundles the UI and a local server sidecar; no Node.js or terminal required.
- **Encrypted wallet vault** — `scrypt` + AES-256-GCM, per-account private keys only (never seed phrases).
- **Test (devnet) / real (mainnet)** network toggle, with a two-step confirmation before switching to real funds.
- Editorial UI with in-app documentation, in English and Spanish.
- **Opt-in auto-update** via GitHub Releases — off by default.
- `SHA256SUMS.txt` published with each release for download integrity verification.

[Unreleased]: https://github.com/pedrojorgelozano/Solana-Auto-Exit/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/pedrojorgelozano/Solana-Auto-Exit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases/tag/v0.1.0
