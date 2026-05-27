# Installing Auto-Exit

This guide covers installing Auto-Exit on **Windows**, **macOS**, and **Linux**.

Two delivery formats exist today:

- **Native desktop installer** — a `.exe`/`.msi` you double-click. **Windows only** at the moment. Cross-compilation isn't a thing for Tauri, so macOS/Linux installers will be published when builds on those operating systems are produced; until then, use Docker.
- **Docker stack** — `docker compose up` runs the same backend and web UI in two containers, accessible from your browser at `http://127.0.0.1:3000`. **Works on Windows, macOS, and Linux.**

## At a glance

| OS | Recommended path | Alternative |
|---|---|---|
| **Windows** | [Native installer](#windows--native-installer-recommended) | [Docker](#windows--docker) · [Build from source](#build-from-source-any-os) |
| **macOS** | [Docker](#macos--docker) | [Build from source](#build-from-source-any-os) |
| **Linux** (Ubuntu/Debian) | [Docker](#linux--docker) | [Build from source](#build-from-source-any-os) |

**Verification status:** the native Windows installer is end-to-end verified on every release (download → install → run → close a real position). The Docker setup is end-to-end verified on Windows (Docker Desktop). macOS and Linux Docker installs are not yet smoke-tested by the author — the steps below are identical because Docker abstracts the host OS, but if you hit an issue please [open an issue](https://github.com/pedrojorgelozano/Solana-Auto-Exit/issues) so we can verify the path.

---

## Windows — Native installer (recommended)

The fastest, lowest-friction path on Windows.

### 1. Download

Open the [latest release](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases/latest) and download one of:

- **`Auto-Exit_<version>_x64-setup.exe`** — recommended. The standard installer.
- `Auto-Exit_<version>_x64_en-US.msi` — alternative (MSI, for managed or clean installs).

Both install the same app. Pick the `.exe` unless you specifically need the MSI.

### 2. Verify the download (recommended)

Every release includes a `SHA256SUMS.txt` listing the expected checksum of each file. Verifying confirms the download wasn't corrupted or tampered with.

Open PowerShell in the folder where you downloaded the file and run (substitute the real file name):

```powershell
Get-FileHash .\Auto-Exit_<version>_x64-setup.exe -Algorithm SHA256
```

Compare the printed hash against the matching line in `SHA256SUMS.txt`. They must match exactly. If they differ, **do not run the installer** — download it again.

### 3. Run the installer

Double-click the `.exe`. The build is **not** OS-code-signed (Apple/Microsoft code-signing certificates are paid), so Windows SmartScreen shows a warning the first time:

> **Windows protected your PC**

This is expected for any unsigned app — it does not by itself mean the app is unsafe. To proceed:

1. Click **More info**.
2. Click **Run anyway**.

Then follow the installer prompts. Auto-Exit installs into your user profile — no administrator rights needed.

### 4. First launch

Open **Auto-Exit** from the Start menu. On first run it:

- Starts a small local server (the "sidecar") that the app talks to on `127.0.0.1` only — nothing is exposed to your network.
- Creates its data folder.

When the bot status in the header shows it is running, everything started correctly. From there, set up a wallet and your first auto-exit — the in-app **Docs** section walks through it.

---

## Windows — Docker

Useful if you prefer to keep Auto-Exit isolated in a container, or if you already run other Docker workloads on this machine.

### Prerequisites

- **Docker Desktop for Windows**. Install from <https://docs.docker.com/desktop/install/windows-install/>. WSL2 backend is the default and fine; the Hyper-V backend also works.
- **Git**. Install from <https://git-scm.com/download/win> or via `winget install --id Git.Git`.

Open PowerShell and confirm both work:

```powershell
docker --version
docker compose version
git --version
```

### Install

```powershell
git clone https://github.com/pedrojorgelozano/Solana-Auto-Exit.git
cd Solana-Auto-Exit
docker compose up -d --build
```

The first build takes ~2–3 minutes (compiles `better-sqlite3` natively + Next.js build). Subsequent runs reuse the cached layers.

When both containers report healthy, open <http://127.0.0.1:3000> in your browser.

```powershell
docker ps                       # both containers should show "Up"
docker compose logs -f          # tail logs (Ctrl+C to detach)
docker compose down             # stop everything cleanly
```

### Important: the data folder

Your encrypted wallet and SQLite database live in `.\packages\server\data\` next to the cloned repo. **Do not delete this folder** unless you intend to lose the wallet and tasks. Back it up if the wallet matters.

---

## macOS — Docker

### Prerequisites

- **Docker Desktop for Mac**. Install from <https://docs.docker.com/desktop/install/mac-install/>. Both Apple Silicon (M1/M2/M3/M4) and Intel are supported. Alternatives like [OrbStack](https://orbstack.dev/) also work — the steps below assume Docker Desktop but apply identically.
- **Git**. macOS ships with Git via Command Line Tools — running `git --version` once will prompt you to install them if missing. Or `brew install git`.

Open Terminal and confirm:

```bash
docker --version
docker compose version
git --version
```

### Install

```bash
git clone https://github.com/pedrojorgelozano/Solana-Auto-Exit.git
cd Solana-Auto-Exit
docker compose up -d --build
```

First build: ~2–3 minutes. When both containers report healthy, open <http://127.0.0.1:3000>.

```bash
docker ps                       # both containers should show "Up"
docker compose logs -f          # tail logs (Ctrl+C to detach)
docker compose down             # stop everything cleanly
```

### Important: the data folder

Your encrypted wallet and SQLite database live in `./packages/server/data/` next to the cloned repo. **Do not delete this folder** unless you intend to lose the wallet and tasks. Back it up if the wallet matters.

### Native installer for macOS?

Not yet published. Building one requires running `tauri build` on macOS hardware (Tauri does not cross-compile). When a build is produced and tested, a `.dmg` will appear on the [releases page](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases) and this guide will be updated.

If you want it sooner, you can [build it yourself from source](#build-from-source-any-os) — the toolchain is Bun + Rust + Xcode CLT.

---

## Linux — Docker

Tested logically against Ubuntu 22.04+ and Debian 12. Other distributions work if Docker + Compose run there.

### Prerequisites

- **Docker Engine** + **Compose plugin**. The official install guide for your distro:
  - Ubuntu: <https://docs.docker.com/engine/install/ubuntu/>
  - Debian: <https://docs.docker.com/engine/install/debian/>
  - Other: <https://docs.docker.com/engine/install/>

  After install, add your user to the `docker` group so you don't need `sudo` for every command (the alternative is prefixing every `docker` command below with `sudo`):

  ```bash
  sudo usermod -aG docker $USER
  # log out and back in for the group change to take effect
  ```

- **Git**:

  ```bash
  sudo apt update && sudo apt install -y git
  ```

Confirm the tools:

```bash
docker --version
docker compose version
git --version
```

### Install

```bash
git clone https://github.com/pedrojorgelozano/Solana-Auto-Exit.git
cd Solana-Auto-Exit
docker compose up -d --build
```

First build: ~2–3 minutes. When both containers report healthy, open <http://127.0.0.1:3000> in your browser.

```bash
docker ps                       # both containers should show "Up"
docker compose logs -f          # tail logs (Ctrl+C to detach)
docker compose down             # stop everything cleanly
```

### Important: the data folder

Your encrypted wallet and SQLite database live in `./packages/server/data/` next to the cloned repo. **Do not delete this folder** unless you intend to lose the wallet and tasks. Back it up if the wallet matters.

If you see permission errors writing to `./packages/server/data/`, the host directory needs to be writable by **uid 1000** — that's the `node` user the container runs as. Docker Desktop (Windows/Mac) handles this transparently; on bare Linux you may need to `chown` (see [troubleshooting](#docker--permission-denied-writing-to-data-linux)).

### Running as a system service

The compose file uses `restart: unless-stopped`, so the containers come back automatically after a host reboot **as long as Docker itself is running at boot**. On Ubuntu, that's the default; if Docker doesn't start at boot, enable it once:

```bash
sudo systemctl enable docker
```

### Native installer for Linux?

Not yet published. Building one requires running `tauri build` on a Linux machine with the right webkit2gtk libraries (Tauri does not cross-compile). When a build is produced and tested, an `.AppImage` and/or `.deb` will appear on the [releases page](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases) and this guide will be updated.

If you want it sooner, you can [build it yourself from source](#build-from-source-any-os) — the toolchain is Bun + Rust + webkit2gtk + libsoup3 + libayatana-appindicator3 + `build-essential`.

---

## Build from source (any OS)

If you'd rather not wait for native installers on macOS/Linux, or you want to develop against Auto-Exit, you can build the app yourself. The toolchain requirements and step-by-step are in the README under [Quick start (Tauri desktop)](../README.md#quick-start-tauri-desktop).

In short: install Bun + Rust + your OS's C/C++ build tools, then `pnpm install && pnpm tauri:build`. The output installer lands in `packages/tauri/target/release/bundle/`.

---

## Where your data lives

The two install formats keep data in different places.

### Native installer (Windows)

| Item | Path |
|---|---|
| Encrypted wallet vault + database | `%APPDATA%\com.autoexit.desktop\` |
| Sidecar log (for troubleshooting) | `%APPDATA%\com.autoexit.desktop\sidecar.log` |
| Application files | `%LOCALAPPDATA%\Auto-Exit\` |

### Docker (any OS)

| Item | Path |
|---|---|
| Encrypted wallet vault + database | `./packages/server/data/` (next to the cloned repo, bind-mounted into the container) |
| Container logs | `docker compose logs server` / `docker compose logs web` |

Back up the vault file if the wallet it holds matters to you — see [SECURITY.md](../SECURITY.md).

---

## Updating

### Native installer (Windows)

Auto-Exit can check GitHub for new versions on startup, but that check is **opt-in and off by default** (it makes a network call). Enable it under **Settings → Updates** if you want it.

With it off, update manually: download the newer installer from the [releases page](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases) and run it over the existing install.

### Docker (any OS)

Pull the latest code and rebuild the image:

```bash
git pull
docker compose up -d --build
```

The bind-mounted `./packages/server/data/` survives the rebuild — your wallet and tasks are preserved.

---

## Uninstalling

### Native installer (Windows)

Use Windows **Settings → Apps** (or "Add or remove programs"), find **Auto-Exit**, and uninstall. Your data folder at `%APPDATA%\com.autoexit.desktop\` is left in place — delete it manually for a full removal.

### Docker (any OS)

```bash
docker compose down                       # stop and remove containers + network
docker image rm solana-auto-exit:latest   # remove the built image (optional)
```

Then delete the cloned repo folder. Your data folder `./packages/server/data/` is inside it; **back it up first if the wallet matters**.

---

## Troubleshooting

### Docker — "port already in use" on 3000 or 7777

Something else on your host is bound to one of those ports. Identify and stop it, or edit `docker-compose.yml` to map different host ports. The container ports (inside the compose) are fixed; only the host side `127.0.0.1:<HOST>:<CONTAINER>` is yours to change.

### Docker — "permission denied" writing to `data/` (Linux)

The container runs as **uid 1000** (the `node` user inside the image — part of the security hardening; see [ADR-037](DECISIONS.md)). The bind mount `./packages/server/data/` on the host therefore needs to be writable by uid 1000.

If your host user is uid 1000 (the default for the first user on Ubuntu desktop), this just works. If not (multi-user host, root-owned data dir, or a uid mismatch), `chown` the directory:

```bash
sudo chown -R 1000:1000 packages/server/data
```

Docker Desktop (Windows/Mac) handles uid mapping transparently, so this is a Linux-only concern.

### Windows installer — "Windows protected your PC"

Expected for any unsigned app. Click **More info** → **Run anyway**. See [step 3](#3-run-the-installer) above.

### "The bot is unreachable" after install (Windows native)

Check the sidecar log at `%APPDATA%\com.autoexit.desktop\sidecar.log` and [open an issue](https://github.com/pedrojorgelozano/Solana-Auto-Exit/issues) with the last 50 lines.

### Container starts but I can't reach `http://127.0.0.1:3000`

Confirm both containers are up: `docker ps` should show `solana-auto-exit-server` and `solana-auto-exit-web` both `Up`. If the web container is missing or restarting, check its log: `docker compose logs web`.

---

## Next steps

Once installed and running, the in-app `/docs` section is the place to start:

- `/docs/getting-started` — the three-step walkthrough.
- `/docs/bot-wallet` — the three honest paths to provide a key and what each one exposes.
- `/docs/security` — threat model and what the tool protects against (and what it doesn't).

If anything in this install guide is wrong or out of date, please [open an issue](https://github.com/pedrojorgelozano/Solana-Auto-Exit/issues).
