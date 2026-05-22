# Changelog

All notable changes to Auto-Exit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Installers and checksums for each release are on the [Releases page](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases).

## [Unreleased]

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

[Unreleased]: https://github.com/pedrojorgelozano/Solana-Auto-Exit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases/tag/v0.1.0
