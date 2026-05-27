# Installing Auto-Exit

This guide covers installing Auto-Exit on **Windows**, **macOS**, and **Linux**.

Three delivery formats exist today:

- **Native desktop installer** — a `.exe`/`.msi` you double-click. **Windows only** at the moment. Cross-compilation isn't a thing for Tauri, so macOS/Linux installers will be published when builds on those operating systems are produced; until then, use Docker or run from source.
- **Docker stack** — `docker compose up` runs the same backend and web UI in two containers, accessible from your browser at `http://127.0.0.1:3000`. **Works on Windows, macOS, and Linux.**
- **Run from source with pnpm** — clone, `pnpm install`, run two commands. **Works on any OS** that has Node + pnpm + a C/C++ toolchain. Useful on hardened hosts where Docker's container network clashes with strict firewall / kill-switch VPN rules, and for development work.

## At a glance

| OS | Recommended path | Alternative |
|---|---|---|
| **Windows** | [Native installer](#windows--native-installer-recommended) | [Docker](#windows--docker) · [Run from source](#run-from-source-with-pnpm-any-os) |
| **macOS** | [Docker](#macos--docker) | [Run from source](#run-from-source-with-pnpm-any-os) · [Build from source](#build-from-source-any-os) |
| **Linux** (Ubuntu/Debian) | [Docker](#linux--docker) | [Run from source](#run-from-source-with-pnpm-any-os) · [Build from source](#build-from-source-any-os) |
| **Hardened Linux** (strict firewall / kill-switch VPN) | [Run from source](#run-from-source-with-pnpm-any-os) | [Build from source](#build-from-source-any-os) |

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

#### 1. Docker Engine + Compose plugin

Install via the official guide for your distro — these always work and stay current:

- Ubuntu: <https://docs.docker.com/engine/install/ubuntu/>
- Debian: <https://docs.docker.com/engine/install/debian/>
- Other: <https://docs.docker.com/engine/install/>

#### 2. Add your user to the `docker` group — **this is the step everyone forgets**

After installing Docker, your regular user **cannot talk to the Docker daemon** until it is in the `docker` group. If you skip this step (or skip the logout below), the **very first** `docker compose up` will fail with the error `permission denied while trying to connect to the Docker API at unix:///var/run/docker.sock`.

Two parts, both required:

**Part A — add the user to the group:**

```bash
sudo usermod -aG docker $USER
```

**Part B — apply the group change to your session.** Linux loads group memberships **at login**. Just opening a new terminal is **not** enough; you must do one of these:

| Option | What to do | When the change takes effect |
|---|---|---|
| **Full logout** (recommended) | Log out of your desktop session and log back in. Or reboot. | All shells in the new session. |
| **`newgrp docker`** (faster, scoped) | In your current terminal, run `newgrp docker`. | Only that shell. The change becomes permanent at your next real login anyway. |

**Verify before continuing.** Open a new terminal (post-logout) or use the `newgrp`'d shell and run:

```bash
id            # the output must include "docker" in the groups list
docker ps     # must succeed without sudo and without permission errors
```

If `id` does **not** show `docker`, the group change hasn't taken effect — log out fully and back in. **Do not move on until both commands above work.**

> **Why not just use `sudo docker compose up`?**
> It works, but every file the container creates in `./packages/server/data/` ends up owned by root on the host. Auto-Exit's container runs as **uid 1000** (security hardening, see [ADR-037](DECISIONS.md)); a root-owned data directory will then trigger permission errors when the container tries to write the wallet vault. Use the `docker` group route — it's the right path on Linux.

#### 3. Git

```bash
sudo apt update && sudo apt install -y git
```

#### 4. Sanity check

All three commands should run without `sudo` and without errors:

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

## Run from source with pnpm (any OS)

Run Auto-Exit directly as Node + pnpm processes — **no Docker, no installer**. Same code as everything else; only the packaging differs.

### When to choose this path

The two main reasons:

#### 1. Your host is hardened (strict firewall + kill-switch VPN)

This is the case that matters most. If your Ubuntu (or any Linux) is configured "no leaks, no exceptions" with `ufw default deny outgoing`, `nftables` with `OUTPUT/FORWARD policy DROP`, a VPN kill-switch that only allows traffic through `wg0`/`tun0`, or similar, then **Docker will not work well for you**.

Why: Docker creates its own subnet (`172.17.0.0/16`, interface `docker0`). Container traffic flows `container → docker0 → FORWARD → default interface → internet`. Your firewall blocks the FORWARD step because `docker0` isn't on the allowlist; your VPN kill-switch drops anything not on the tunnel interface. The host resolves DNS fine (host processes use the VPN), the container does not. Even if you fix DNS with `daemon.json`, **runtime traffic to the Solana RPC will hit the same wall** — the app needs to read pool prices and broadcast transactions, all from inside the container.

Running directly with `pnpm` sidesteps this entirely. The backend and web are processes of **your user**, not separated in a docker subnet. Your existing firewall and VPN rules apply to them like to any other application — no separate network layer to authorize. The result is what you want: the only outbound calls go to the RPC endpoint you configure (your VPN already allows that for your normal browsing), and nothing else.

#### 2. You're developing against Auto-Exit

Hot module reload, faster feedback loops, direct access to logs, easy to attach a debugger.

If your host is "default-trust" (Docker can outbound freely), the Docker path is more convenient — single command, persistent across reboots, container isolation. The `pnpm` path is for hardened hosts and developers.

### Prerequisites — install these first

You need four tools: **Node.js**, **pnpm**, **Git**, and a **C/C++ build toolchain** (needed because `better-sqlite3` compiles natively against your installed Node). Pick your OS below and follow the steps in order. **Verify each step before moving on** — if `node` isn't found, `pnpm` won't be either.

> **Already have Node 22 or 24 and Git?** Skip to step 2 (pnpm) in your OS section. If you only need the toolchain, run the sanity check at the end first.

#### Windows

**1. Install Node.js.** Download the **LTS** installer from <https://nodejs.org/> (any LTS version from 22.x onward works). Default options are fine. The installer bundles `npm` and `corepack`.

Open a **brand new** PowerShell window (so it picks up the updated PATH) and verify:

```powershell
node --version    # should print v22.x.x or newer
npm --version
```

If `node` is not recognized, log out and log back in (or reboot) — the installer adds Node to your PATH at user level, but already-open shells don't see it.

**2. Install pnpm via Corepack** (Corepack ships with Node 16+; no separate download):

```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

Verify in another fresh PowerShell window:

```powershell
pnpm --version    # should print 10.x or 11.x
```

If `pnpm` still isn't found:
- Confirm you opened a **new** terminal after step 1 (not the same one).
- Check that `%APPDATA%\npm` or `%LOCALAPPDATA%\pnpm` is in your `$env:Path`.
- As a fallback, the classic install works too: `npm install -g pnpm@11`.

**3. Install Git.** Download from <https://git-scm.com/download/win>, or via `winget`:

```powershell
winget install --id Git.Git -e
```

New terminal, then `git --version`.

**4. Install Visual Studio Build Tools 2022.** Download from <https://visualstudio.microsoft.com/visual-cpp-build-tools/>. In the installer, on the "Workloads" tab, **check "Desktop development with C++"** (the default selection on the right is fine). Without this, `pnpm install` will fail when building `better-sqlite3`.

#### Ubuntu / Debian

**1. Install Node.js via nvm.** The Node packaged in `apt` (`apt install nodejs`) is usually too old — use [nvm](https://github.com/nvm-sh/nvm) so you control the version:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Load nvm in your current shell (the installer added this to ~/.bashrc but
# already-open shells need an explicit reload):
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use the current LTS:
nvm install --lts
nvm use --lts
```

Verify:

```bash
node --version    # v22.x.x or newer
npm --version
```

If you open a new terminal later and `node` isn't found, your shell didn't auto-load nvm. Add the two `export` / `[ -s ]` lines above to your `~/.bashrc` or `~/.zshrc` (the nvm installer normally does this, but some setups skip it).

**2. Install pnpm via Corepack:**

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Verify: `pnpm --version`.

**3. Install Git and the build toolchain:**

```bash
sudo apt update
sudo apt install -y git build-essential python3
```

`build-essential` brings GCC + make. `python3` is required by `node-gyp` for the native compile of `better-sqlite3`.

#### macOS

**1. Install Node.js via nvm:**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# macOS default shell is zsh — reload:
source ~/.zshrc      # or open a new terminal

nvm install --lts
nvm use --lts
node --version
```

Alternative (no version manager): the installer at <https://nodejs.org/> also works on macOS.

**2. Install pnpm via Corepack:**

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
```

**3. Install Xcode Command Line Tools** (provides `git` and the C/C++ toolchain in one shot):

```bash
xcode-select --install
```

Follow the GUI prompt. After it finishes:

```bash
git --version
cc --version
```

#### Sanity check (all OS)

These four commands should all print a version with no errors. If any fails, fix that step before moving to the install:

```bash
node --version    # 22.x or newer
pnpm --version    # 10.x or 11.x
git --version
# C/C++ toolchain check — Linux/macOS:
echo 'int main(){return 0;}' > /tmp/cctest.c && cc /tmp/cctest.c -o /tmp/cctest && echo "C/C++ OK" && rm /tmp/cctest /tmp/cctest.c
# On Windows the toolchain check is implicit: if Visual Studio Build Tools 2022
# is installed with "Desktop development with C++", pnpm install below will
# pick it up. If not, you'll see an error mentioning MSBuild or node-gyp.
```

### Install

```bash
git clone https://github.com/pedrojorgelozano/Solana-Auto-Exit.git
cd Solana-Auto-Exit
pnpm install
```

`pnpm install` takes ~1–3 minutes. It downloads dependencies and compiles `better-sqlite3` natively against your installed Node — that's why the C/C++ toolchain is required.

### Run (two long-running processes)

You need the backend and the web UI running at the same time. Open two terminals (or use `tmux` / `screen` — see "Running 24/7" below).

**Terminal 1 — backend** (listens on `127.0.0.1:7777`):

```bash
cd Solana-Auto-Exit
pnpm dev:server
```

You should see `[server] listening on http://127.0.0.1:7777` and the vault path message.

**Terminal 2 — web UI** (listens on `127.0.0.1:3000`):

```bash
cd Solana-Auto-Exit
pnpm dev:web
```

You should see `✓ Ready in <N> ms`.

Open <http://127.0.0.1:3000> in your browser. The app should look identical to the Docker / desktop builds. From there, the in-app `/docs` walks through wallet setup and your first auto-exit.

**To stop**: `Ctrl+C` in each terminal. The data folder persists.

### Where your data lives (this mode)

Your encrypted wallet and SQLite database live in `./packages/server/data/` next to the cloned repo. **Do not delete this folder** unless you intend to lose the wallet and tasks. Back it up if the wallet matters.

### Running 24/7 (Linux, optional)

`pnpm dev:server` and `pnpm dev:web` are foreground processes — closing the terminal stops them. For a setup that survives reboots and logouts, two options, from simplest to most proper:

#### Option 1 — `tmux` (5 minutes of setup)

`tmux` lets you keep processes alive after you detach the terminal.

```bash
sudo apt install tmux       # Ubuntu/Debian (skip if you have it)
tmux new -s auto-exit       # creates a session named "auto-exit"
```

Inside the tmux session:

```bash
cd Solana-Auto-Exit
pnpm dev:server &           # backend in background within tmux
pnpm dev:web                # web in foreground
```

Detach without stopping anything: press `Ctrl+B`, then `D`. The processes keep running. Reattach later with `tmux attach -t auto-exit`. Logs from `dev:server` appear in the same pane (it ran with `&`).

Caveat: tmux session dies on reboot. For survive-reboot, use Option 2.

#### Option 2 — `systemd` user unit (proper, restarts on boot)

Two unit files in `~/.config/systemd/user/`. Substitute `<USER>` and adjust paths if your `pnpm` is elsewhere (find with `which pnpm`).

Create `~/.config/systemd/user/auto-exit-server.service`:

```ini
[Unit]
Description=Auto-Exit backend
After=network-online.target

[Service]
Type=simple
WorkingDirectory=%h/Solana-Auto-Exit
ExecStart=/bin/bash -lc 'pnpm dev:server'
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Create `~/.config/systemd/user/auto-exit-web.service`:

```ini
[Unit]
Description=Auto-Exit web UI
After=auto-exit-server.service

[Service]
Type=simple
WorkingDirectory=%h/Solana-Auto-Exit
ExecStart=/bin/bash -lc 'pnpm dev:web'
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Why `/bin/bash -lc 'pnpm ...'`: systemd doesn't load your user shell PATH, so a bare `pnpm` wouldn't be found. The login shell (`-l`) loads `.bashrc` / `.profile` where pnpm's PATH lives.

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable --now auto-exit-server auto-exit-web
loginctl enable-linger $USER     # keep services running when you log out
```

Check status and tail logs:

```bash
systemctl --user status auto-exit-server auto-exit-web
journalctl --user -u auto-exit-server -f          # live backend logs
journalctl --user -u auto-exit-web -f             # live web logs
```

Stop / restart:

```bash
systemctl --user restart auto-exit-server
systemctl --user stop auto-exit-server auto-exit-web
```

### Running 24/7 (macOS, optional)

macOS uses `launchd` instead of `systemd`. Two `.plist` files in `~/Library/LaunchAgents/`. The shape is similar; full guide out of scope here — see `man launchd.plist` and the Apple docs. The `tmux` approach above also works on macOS unchanged.

### Running 24/7 (Windows, optional)

Windows has Task Scheduler (built in) and tools like [NSSM](https://nssm.cc/) for running arbitrary commands as services. Out of scope here; the Tauri native installer is the recommended path on Windows.

### Updating

```bash
cd Solana-Auto-Exit
git pull
pnpm install --frozen-lockfile     # only re-runs if pnpm-lock.yaml changed
```

Then restart the processes:

- **Foreground terminals:** `Ctrl+C` and re-run `pnpm dev:server` / `pnpm dev:web`.
- **tmux:** kill the session (`tmux kill-session -t auto-exit`) and start a new one.
- **systemd:** `systemctl --user restart auto-exit-server auto-exit-web`.

The data folder `./packages/server/data/` survives the update — your wallet and tasks are preserved.

### Uninstalling

If you used systemd, disable the units first:

```bash
systemctl --user disable --now auto-exit-server auto-exit-web
rm ~/.config/systemd/user/auto-exit-server.service ~/.config/systemd/user/auto-exit-web.service
systemctl --user daemon-reload
loginctl disable-linger $USER       # optional, only if you don't use linger for anything else
```

Then delete the cloned repo folder. The data folder `./packages/server/data/` is inside it — **back it up first if the wallet matters**.

### Caveats versus Docker

- **No container isolation.** A bug or malicious code in a transitive dependency runs with the privileges of your user. The mitigations Docker gave you (`read_only` rootfs, `cap_drop`, separate uid, capability filtering) don't apply. Your defense is at the OS level — your firewall, file permissions, and the fact that the wallet vault is **encrypted at rest** and only RAM-decrypted while unlocked (see [SECURITY.md](../SECURITY.md) and the wallet-related ADRs in [DECISIONS.md](DECISIONS.md)).
- **No automatic restart on boot** unless you set up systemd (Option 2 above). The `tmux` approach survives terminal close but not reboot.
- **`pnpm dev:*` runs in development mode**, which is what the per-package `dev` scripts use today. For self-hosted single-user this is fine. If you specifically want production mode, the scripts exist too — server: `pnpm --filter @solana-auto-exit/server start`. Web: `pnpm --filter @solana-auto-exit/web build` once, then `pnpm --filter @solana-auto-exit/web exec next start -H 127.0.0.1 -p 3000` to serve.
- **Same audit applies.** Same code, same RPC-only outbound, no telemetry. The network-egress audit ([SECURITY-AUDIT.md](SECURITY-AUDIT.md)) was done on this exact codebase.

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

### Docker or Run from source (any OS)

| Item | Path |
|---|---|
| Encrypted wallet vault + database | `./packages/server/data/` next to the cloned repo. Docker bind-mounts it into the container; `pnpm dev:server` writes to it directly. Same file format either way. |
| Logs | Docker: `docker compose logs server` / `docker compose logs web`. pnpm: stdout of each `pnpm dev:*` terminal (or `journalctl --user -u auto-exit-server` if running via systemd). |

Back up the vault file if the wallet it holds matters to you — see [SECURITY.md](../SECURITY.md).

---

## Privacy: Docker Desktop telemetry (Windows / macOS only)

Skip this section if you're on Linux with **Docker Engine** (no Desktop) — that path has no telemetry.

**Docker Desktop** (the GUI app you install on Windows and macOS) ships several outbound network channels enabled by default. Auto-Exit itself doesn't send anything, but Docker Desktop as a host does. If your threat model includes "no unnecessary egress from this machine" — typical for someone running a self-hosted DeFi tool — these are worth knowing and turning off.

### What's on by default

| Channel | What it sends | How to disable |
|---|---|---|
| **Usage statistics** | Anonymized telemetry of how you use Docker Desktop. | **Settings → General → "Send usage statistics"** — uncheck. |
| **Update checks** | Contacts Docker's update servers on every launch to see if a new version is out. | **Settings → Software updates** — uncheck "Automatically check for updates" and "Notify me about updates". Update manually when you want by downloading from <https://docs.docker.com/desktop/release-notes/>. |
| **Docker AI / Ask Gordon** | Any prompt or context you give to the AI assistant is sent to Docker's AI service. | **Settings → Features in development** (location varies by version) — uncheck "Docker AI" / "Ask Gordon". |
| **Docker Scout** | Scans local images and uploads metadata to Scout for vulnerability reports. Only active when you're signed in to a Docker Hub account. | **Sign out** of Docker Hub (avatar menu, top-right) if you don't use it. Or: **Settings → Docker Scout** — disable. |
| **Feature flags (Unleash)** | Docker Desktop periodically fetches feature-flag configuration from `unleash.docker.com`. No UI toggle. | Only blockable at the OS firewall (allow outbound only to `registry-1.docker.io` for image pulls; deny everything else from `Docker Desktop.exe` / `com.docker.backend.exe`). Most users live with this. |
| **Image pulls** | Every `docker compose up --build` (when layers aren't cached) pulls the base image (`node:24-alpine`) from `registry-1.docker.io`. This is necessary for builds. | Can't disable, but it's not telemetry — it's the registry traffic that makes Docker work. Cached after the first pull. |

### Strict path: Docker Engine on Linux

If "absolutely no Docker telemetry" is a hard requirement and you have a Linux machine available, **Docker Engine** (the daemon + CLI, no GUI) on Linux has none of the above — no usage stats, no Unleash, no Scout-by-default, no update checks. The only outbound traffic is registry pulls when you build. Same `docker compose up` workflow as Docker Desktop. See [Linux — Docker](#linux--docker).

On Windows, Docker Engine can run inside a WSL2 distro without Docker Desktop on top — same egress profile as native Linux, more friction to set up. Out of scope for this guide.

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

### Docker — "permission denied ... unix:///var/run/docker.sock" (Linux)

Full error message: `permission denied while trying to connect to the Docker API at unix:///var/run/docker.sock`.

Your user is not in the `docker` group, or it is but you haven't logged out and back in yet. See [Linux — Prerequisites, step 2](#2-add-your-user-to-the-docker-group--this-is-the-step-everyone-forgets) — both adding the user and re-logging in are required.

### Docker build fails with "DNS: transient error" while running `apk add` (Linux)

You'll see this during `docker compose up --build`, inside the `[deps 2/11] RUN apk add ...` step:

> `WARNING: fetching https://dl-cdn.alpinelinux.org/alpine/v3.23/main/x86_64/APKINDEX.tar.gz: DNS: transient error (try again later)`

…followed by `ERROR: unable to select packages: g++ / make / python3 (no such package)` and the build fails with exit code 3.

**What it means.** The Docker daemon's build network can't resolve DNS even though your host can. Common on Ubuntu when `systemd-resolved` runs a local stub at `127.0.0.53` that Docker's container network can't reach, or with some VPN / corporate-network setups.

**Diagnose**:

```bash
# Does your HOST resolve? (it almost certainly does)
ping -c 3 dl-cdn.alpinelinux.org

# Does Docker's container network resolve?
docker run --rm alpine sh -c "apk update"
```

If the `ping` succeeds but the `docker run` fails with DNS errors, you're hitting this case.

**Fix — set explicit DNS servers for the Docker daemon:**

```bash
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{
  "dns": ["1.1.1.1", "8.8.8.8"]
}
EOF
sudo systemctl restart docker
```

(If `/etc/docker/daemon.json` already exists, merge the `"dns"` key into it instead of overwriting.)

Verify the fix:

```bash
docker run --rm alpine sh -c "apk update"   # should succeed quickly
```

Then retry the install:

```bash
cd ~/Solana-Auto-Exit
docker compose up -d --build
```

**If `docker run --rm alpine sh -c "apk update"` still fails after the fix above**, your network is blocking outbound DNS to public servers (`8.8.8.8`, `1.1.1.1`, etc.). Common with:

- **ISP / router DNS interception** — some ISPs and home routers (Asuswrt-Merlin, OpenWrt, etc.) block or hijack outbound port 53 to anything other than their own DNS.
- **Pi-Hole or AdGuard Home** on the network — may not respond to queries from the Docker bridge subnet, or may only respond to queries from MAC-allow-listed devices.
- **Corporate firewall** — only allows DNS to specific approved upstream servers.

The container is configured with a public DNS but those queries never get out of your network — that's why the host (which uses the router as DNS) resolves fine, but the container (which goes directly to public DNS) doesn't.

**Fix — use the same DNS your host uses upstream.** That IP is guaranteed to be allowed because the host already resolves through it.

Find it (Ubuntu / Debian with systemd-resolved, the default):

```bash
resolvectl status | grep -E "Current DNS|DNS Servers"
```

You'll see something like `Current DNS Server: 192.168.1.1` (your router) or `Current DNS Server: 80.58.61.250` (your ISP's DNS). That IP is what you want.

Then replace the DNS list in `daemon.json` with that IP, plus one public DNS as a fallback in case the upstream is offline (`9.9.9.9` Quad9 tends to be permitted when `8.8.8.8` isn't):

```bash
# Substitute 192.168.1.1 with the IP "resolvectl status" returned.
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{
  "dns": ["192.168.1.1", "9.9.9.9"]
}
EOF
sudo systemctl restart docker
```

Verify and retry the build:

```bash
docker run --rm alpine sh -c "apk update"        # should succeed now
cd ~/Solana-Auto-Exit && docker compose up -d --build
```

**Still failing?** The next suspects are a corporate proxy (set `httpProxy` / `httpsProxy` in `/etc/docker/daemon.json` — see Docker docs) or a host firewall (iptables / nftables / ufw) blocking outbound traffic from the `docker0` / `br-*` interfaces. Diagnose with `docker info`, `sudo iptables -L -n -v | grep docker`, and check your distro's networking config.

### Docker — "permission denied" writing to `data/` (Linux)

The container runs as **uid 1000** (the `node` user inside the image — part of the security hardening; see [ADR-037](DECISIONS.md)). The bind mount `./packages/server/data/` on the host therefore needs to be writable by uid 1000.

If your host user is uid 1000 (the default for the first user on Ubuntu desktop), this just works. If not (multi-user host, root-owned data dir, or a uid mismatch), `chown` the directory:

```bash
sudo chown -R 1000:1000 packages/server/data
```

Docker Desktop (Windows/Mac) handles uid mapping transparently, so this is a Linux-only concern.

### "pnpm: command not found" or "El término 'pnpm' no se reconoce" (Run from source)

You haven't completed the prerequisites for the [Run from source with pnpm](#run-from-source-with-pnpm-any-os) path. The most common reasons:

- **Node.js isn't installed yet.** `pnpm` is installed via Node's bundled `corepack` or via `npm install -g pnpm`, so without Node there's no path to pnpm. Go through step 1 in the OS section first.
- **You're in the same terminal where you installed Node.** New PATH entries don't apply to already-open shells. Open a fresh terminal and try again.
- **You installed Node but skipped `corepack enable` / `corepack prepare pnpm@latest --activate`**. Node ships with corepack but doesn't activate pnpm by default until you ask for it.
- **On Linux, nvm isn't loaded in your shell.** If you closed and reopened the terminal after the nvm install but `node` itself isn't found either, your shell startup file doesn't source nvm. Re-run the two `export NVM_DIR / [ -s $NVM_DIR/nvm.sh ]` lines from the Ubuntu section, and append them to `~/.bashrc` (or `~/.zshrc`) so future shells load it.

Verify with `node --version && pnpm --version` in a **new** terminal. Both must print before `pnpm install` will work.

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
