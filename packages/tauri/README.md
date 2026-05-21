# Tauri shell

Empaqueta el web bundle + el server como app de escritorio nativa (Win/Mac/Linux) usando [Tauri v2](https://tauri.app). Sustituye en el futuro al flujo "clona el repo + `pnpm dev`" por un `.dmg` / `.msi` / `.AppImage` que el usuario doble-clica.

## Requisitos en la máquina de dev

| Pieza | Cómo |
|---|---|
| **Rust toolchain** | https://rustup.rs/ → `rustup-init.exe` (Windows) o `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` (Mac/Linux). Defaults OK. |
| **Microsoft C++ Build Tools** (Windows only) | https://visualstudio.microsoft.com/visual-cpp-build-tools/ — al instalar selecciona el workload **Desktop development with C++**. ~5 GB. Sin esto, `rustc` no puede linkar contra WebView2. |
| **WebView2 runtime** (Windows only) | Suele venir preinstalado con Windows 10/11 actualizado. Si no, https://developer.microsoft.com/en-us/microsoft-edge/webview2/. |
| **`pnpm install`** desde la raíz del monorepo | Instala `@tauri-apps/cli` en este package. |

Verificar con `rustc --version` tras reiniciar la shell.

## Estado actual (F4.1.a)

- **`pnpm tauri:dev`** desde la raíz arranca el server de Next.js (vía `beforeDevCommand`) y abre una ventana nativa apuntando a `http://localhost:3000`. La app se ve como en el navegador, pero en su propia ventana.
- **`pnpm tauri:build`** intentaría producir un instalador, pero **falla hoy** porque:
  1. El frontend Next.js no tiene `output: 'export'` configurado (falta `generateStaticParams` en los `[mint]` y `[id]` para pre-renderizar). Necesita F4.1.b.
  2. El backend Hono no está bundlado como sidecar — el binario instalado abriría una ventana que no puede hablar con ningún servidor. Necesita F4.1.b.
  3. Los iconos referenciados en `tauri.conf.json` (`icons/*.png`, `*.icns`, `*.ico`) no existen todavía. Tauri usa placeholders en dev, pero para bundle hacen falta. Hay un task aparte.

En resumen: **`tauri:dev` funciona** (para que tú y yo veamos la app en una ventana propia); **`tauri:build` está pendiente de F4.1.b**.

## Cómo arrancar dev

```bash
# Desde la raíz del monorepo. Necesitas también el server corriendo en
# otra terminal (Tauri solo arranca el web, no el backend):
pnpm dev:server          # terminal 1

pnpm tauri:dev           # terminal 2 — abre una ventana nativa
```

`tauri:dev` invoca internamente `pnpm --filter @solana-auto-exit/web dev`, espera a que el server Next.js arranque en `localhost:3000`, y entonces abre la ventana cargando esa URL. Cualquier cambio en el frontend se hot-reloadea como en el navegador.

## Cómo se ve por dentro

```
packages/tauri/
├── package.json          (declara @tauri-apps/cli como devDep)
├── Cargo.toml            (manifest Rust: tauri 2.0, perfiles release optimizados)
├── tauri.conf.json       (config principal: ventana, build commands, bundle)
├── build.rs              (build script Rust — invoca tauri-build)
├── src/
│   ├── main.rs           (entry point Win/Mac/Linux, wrapper mínimo)
│   └── lib.rs            (Tauri Builder + setup() — donde irá el sidecar)
├── icons/                (TODO — iconos para el bundle)
└── target/               (build artifacts Rust — gitignored)
```

El binario que produce Tauri en `target/release/` (tras `tauri build` cuando funcione) lleva embebido:
1. El runtime Rust + Tauri (binding nativo a la window y al WebView2/WKWebView/WebKitGTK).
2. El frontend Next.js compilado estáticamente.
3. (F4.1.b) El server Node empaquetado como sidecar.

## Lo que NO está aquí (sub-piezas siguientes)

| Sub-pieza | Qué falta |
|---|---|
| **F4.1.b** | Sidecar bundling — empaquetar el server Hono/Node como binario único (probablemente vía `bun build --compile` o Node SEA). Configurar Tauri para spawnearlo en `setup()` y matarlo al cerrar la ventana. Configurar Next.js `output: 'export'` + `generateStaticParams` en las dynamic routes. Iconos (placeholders al menos). |
| **F4.2** | Codesign + auto-update vía GitHub Releases. Mac requiere Apple Developer ID (~$99/año). Windows codesign EV es ~$200/año. Para distribución a "amigos técnicos" sin codesign se acepta el SmartScreen warning de primera ejecución. El updater de Tauri tiene su propia firma (gratis) independiente del codesign del SO. |

## Referencias

- Tauri v2 docs: https://v2.tauri.app/
- Sidecar / external binaries: https://v2.tauri.app/develop/sidecar/
- Bundling guide: https://v2.tauri.app/distribute/
