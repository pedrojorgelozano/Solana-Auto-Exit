# Changelog

All notable changes to Auto-Exit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Installers and checksums for each release are on the [Releases page](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases).

## [Unreleased]

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
