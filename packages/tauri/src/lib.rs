// Entry point del shell Tauri. Por convención v2, el grueso de la app
// vive en una lib crate y main.rs es solo el wrapper. Esto deja la
// puerta abierta a F4-mobile si algún día nos da por ahí, sin tener
// que reorganizar el código.

use std::sync::Mutex;

use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

/// Handle al child process del sidecar guardado en el state global.
/// Lo usamos para matarlo cuando la ventana se cierra (sin esto, el
/// proceso Node queda huérfano en el sistema operativo).
#[derive(Default)]
struct SidecarHandle(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarHandle::default())
        .setup(|app| {
            // `app_data_dir`: writable, per-OS, para la DB SQLite y el vault.
            //    Windows: %APPDATA%/com.autoexit.desktop
            //    macOS:   ~/Library/Application Support/com.autoexit.desktop
            //    Linux:   $XDG_DATA_HOME/com.autoexit.desktop
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("app_data_dir unavailable");
            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create app_data_dir");

            // El sidecar es el runtime de Bun; ejecuta el server desplegado en
            // `server-app/` (lo genera `pnpm build:server-binary`).
            //  - dev (`tauri dev`): server-app/ se lee de `binaries/` vía
            //    CARGO_MANIFEST_DIR, sin pasar por el mecanismo de resources.
            //  - release: se resuelve desde `resource_dir()`. El empaquetado
            //    real de server-app (paths largos / aplanado) es de F4.2.
            let server_app_dir = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("binaries")
                    .join("server-app")
            } else {
                app.path()
                    .resource_dir()
                    .expect("resource_dir unavailable")
                    .join("server-app")
            };
            let server_entry = server_app_dir.join("src").join("main.ts");
            let migrations_dir = server_app_dir.join("drizzle");

            let db_path = app_data_dir.join("auto-exit.db");
            let vault_path = app_data_dir.join("wallet.vault");

            // Spawn del sidecar. `auto-exit-server` es el runtime de Bun, que
            // Tauri resuelve a `binaries/auto-exit-server-<triple>[.exe]`
            // (config en tauri.conf.json `bundle.externalBin`). Se le pasa el
            // entrypoint del server desplegado como argumento.
            let sidecar = app
                .shell()
                .sidecar("auto-exit-server")
                .expect("sidecar binary not found")
                .args([server_entry.to_string_lossy().to_string()])
                .env("DB_PATH", db_path.to_string_lossy().to_string())
                .env(
                    "WALLET_VAULT_PATH",
                    vault_path.to_string_lossy().to_string(),
                )
                .env(
                    "DRIZZLE_MIGRATIONS",
                    migrations_dir.to_string_lossy().to_string(),
                )
                .env("SERVER_PORT", "7777")
                .env("SERVER_HOST", "127.0.0.1")
                .env(
                    "CORS_ORIGINS",
                    "http://127.0.0.1:3000,http://localhost:3000,tauri://localhost",
                );

            let (mut rx, child) = sidecar.spawn().expect("failed to spawn sidecar");

            // Guardamos el handle para matarlo en RunEvent::Exit más abajo.
            let handle = app.state::<SidecarHandle>();
            *handle.0.lock().unwrap() = Some(child);

            // Drenamos stdout/stderr del sidecar al log de Tauri para que
            // los errores del server sean visibles durante desarrollo y al
            // depurar bugs reportados (`pnpm tauri dev` los muestra).
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[sidecar] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[sidecar] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!(
                                "[sidecar] terminated (code={:?}, signal={:?})",
                                payload.code, payload.signal
                            );
                        }
                        CommandEvent::Error(err) => {
                            eprintln!("[sidecar] error: {}", err);
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Cuando la app sale (todas las ventanas cerradas + plataformas
            // que terminan en ese punto), matamos el sidecar para no dejar
            // un proceso server huérfano en el SO.
            if let RunEvent::Exit = event {
                let handle = app_handle.state::<SidecarHandle>();
                // Sacamos el child a una variable propia para soltar el
                // MutexGuard antes de fin de bloque: si no, el guard temporal
                // sigue prestado de `handle` cuando `handle` se dropea (E0597).
                let child = handle.0.lock().unwrap().take();
                if let Some(child) = child {
                    let _ = child.kill();
                }
            }
        });
}
