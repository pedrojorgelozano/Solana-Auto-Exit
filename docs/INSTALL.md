# Installing Auto-Exit (Windows)

Auto-Exit ships as a Windows desktop app. This guide covers downloading, verifying, and installing it.

> **Windows only for now.** Builds are produced on Windows; macOS and Linux are not yet packaged.

## 1. Download

Open the [latest release](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases/latest) and download one of:

- **`Auto-Exit_<version>_x64-setup.exe`** — recommended. The standard installer.
- `Auto-Exit_<version>_x64_en-US.msi` — alternative (MSI, for managed or clean installs).

Both install the same app. Pick the `.exe` unless you specifically need the MSI.

## 2. Verify the download (recommended)

Every release includes a `SHA256SUMS.txt` listing the expected checksum of each file. Verifying confirms the download wasn't corrupted or tampered with.

Open PowerShell in the folder where you downloaded the file and run (substitute the real file name):

```powershell
Get-FileHash .\Auto-Exit_<version>_x64-setup.exe -Algorithm SHA256
```

Compare the printed hash against the matching line in `SHA256SUMS.txt`. They must match exactly. If they differ, **do not run the installer** — download it again.

## 3. Run the installer

Double-click the `.exe`. The build is **not** OS-code-signed (Apple/Microsoft code-signing certificates are paid), so Windows SmartScreen shows a warning the first time:

> **Windows protected your PC**

This is expected for any unsigned app — it does not by itself mean the app is unsafe. To proceed:

1. Click **More info**.
2. Click **Run anyway**.

Then follow the installer prompts. Auto-Exit installs into your user profile — no administrator rights needed.

## 4. First launch

Open **Auto-Exit** from the Start menu. On first run it:

- Starts a small local server (the "sidecar") that the app talks to on `127.0.0.1` only — nothing is exposed to your network.
- Creates its data folder.

When the bot status in the header shows it is running, everything started correctly. From there, set up a wallet and your first auto-exit — the in-app **Docs** section walks through it.

## Where your data lives

- **Encrypted wallet vault** and **database**: `%APPDATA%\com.autoexit.desktop\`
- **Sidecar log** (useful for troubleshooting): `%APPDATA%\com.autoexit.desktop\sidecar.log`
- **Application files**: `%LOCALAPPDATA%\Auto-Exit\`

Back up the vault file if the wallet it holds matters to you — see [SECURITY.md](../SECURITY.md).

## Updating

Auto-Exit can check GitHub for new versions on startup, but that check is **opt-in and off by default** (it makes a network call). Enable it under **Settings → Updates** if you want it.

With it off, update manually: download the newer installer from the [releases page](https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases) and run it over the existing install.

## Uninstalling

Use Windows **Settings → Apps** (or "Add or remove programs"), find **Auto-Exit**, and uninstall. Your data folder at `%APPDATA%\com.autoexit.desktop\` is left in place — delete it manually for a full removal.
