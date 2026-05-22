# Releasing

Cómo publicar una versión de la app desktop (Auto-Exit) con auto-update.
Contexto y decisiones en [ADR-032](DECISIONS.md).

## Una sola vez: keypair del updater

El updater firma cada release con una keypair propia (minisign), independiente
del codesign del SO. Genérala una vez:

```
pnpm --filter @solana-auto-exit/tauri exec tauri signer generate -w "$HOME/.tauri/auto-exit-updater.key"
```

Produce dos ficheros:

- `auto-exit-updater.key` — **clave privada, SECRETA**. No la subas al repo.
  Guárdala tú (gestor de contraseñas; o un GitHub Actions secret si algún día
  hay CI de release).
- `auto-exit-updater.key.pub` — clave pública. Su contenido ya está en
  `packages/tauri/tauri.conf.json` → `plugins.updater.pubkey`.

## Cada release

1. Sube el número de versión en `packages/tauri/tauri.conf.json` (`version`)
   y en los `package.json` que corresponda.

2. Build firmado, con las env vars de la clave privada. El flag
   `--config tauri.updater.conf.json` activa la generación de artefactos de
   update (no va en el config base para no romper `tauri build` a quien no
   tenga la clave):

   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$HOME/.tauri/auto-exit-updater.key" -Raw
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<la contraseña de la key>"
   pnpm tauri:release
   ```

   Produce, en `packages/tauri/target/release/bundle/`:
   - `nsis/Auto-Exit_<ver>_x64-setup.exe` + `nsis/Auto-Exit_<ver>_x64-setup.exe.sig`
   - `msi/Auto-Exit_<ver>_x64_en-US.msi` + `msi/...msi.sig`

3. Escribe `latest.json` (Tauri no lo autogenera). El `signature` es el
   contenido literal del fichero `.sig` del instalador NSIS:

   ```json
   {
     "version": "<ver>",
     "notes": "<changelog breve>",
     "pub_date": "<ISO-8601, p.ej. 2026-05-22T10:00:00Z>",
     "platforms": {
       "windows-x86_64": {
         "signature": "<contenido de Auto-Exit_<ver>_x64-setup.exe.sig>",
         "url": "https://github.com/pedrojorgelozano/Solana-Auto-Exit/releases/download/v<ver>/Auto-Exit_<ver>_x64-setup.exe"
       }
     }
   }
   ```

   Añade entradas `darwin-x86_64` / `linux-x86_64` si algún día se buildea en
   esos OS (cada una con su propio `.sig` y `url`).

4. Crea la Release en GitHub con tag `v<ver>` y sube como assets:
   - el instalador NSIS `.exe` (y opcionalmente el `.msi` para instalación
     limpia)
   - `latest.json` — debe llamarse exactamente así: el endpoint del updater
     apunta a `releases/latest/download/latest.json`.

## Cómo se comprueban los updates

El auto-check es **opt-in**: solo corre si el usuario lo activó en
`/settings` → panel "Updates" (off por defecto — el check hace egress a
GitHub; ver [ADR-033](DECISIONS.md)). Si está activado, la app al arrancar
llama a `check_for_updates` (`packages/tauri/src/lib.rs`): descarga
`latest.json`, compara la versión, y si hay una nueva muestra un diálogo
nativo. Si el usuario acepta, descarga el instalador, verifica su firma
contra la pubkey de `tauri.conf.json`, instala y reinicia.

Para que un release llegue automáticamente a un usuario, este debe tener
el opt-in activado; sin él la actualización es manual (descargar el
instalador nuevo desde la Release de GitHub).
