// Entry point del shell Tauri. Por convención v2, el grueso de la app
// vive en una lib crate y main.rs es solo el wrapper. Esto deja la
// puerta abierta a F4-mobile si algún día nos da por ahí, sin tener
// que reorganizar el código.

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Manager, RunEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use tauri_plugin_updater::UpdaterExt;

/// Handle al child process del sidecar guardado en el state global.
/// Lo usamos para matarlo cuando la ventana se cierra (sin esto, el
/// proceso Node queda huérfano en el sistema operativo).
#[derive(Default)]
struct SidecarHandle(Mutex<Option<CommandChild>>);

/// Quita el prefijo verbatim `\\?\` que Tauri devuelve en Windows desde
/// `resource_dir()` / `app_data_dir()`. El sidecar es código JS que concatena
/// rutas con `/` (p.ej. drizzle: `${dir}/meta/_journal.json`), y las rutas
/// `\\?\` no toleran forward slashes — sin esto, la migración falla con ENOENT.
fn strip_verbatim(p: PathBuf) -> PathBuf {
    let s = p.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{rest}"))
    } else if let Some(rest) = s.strip_prefix(r"\\?\") {
        PathBuf::from(rest)
    } else {
        p
    }
}

/// Override correctivo de `window.confirm` para el webview.
///
/// `tauri-plugin-dialog` 2.7.1 inyecta un `init-iife.js` que reemplaza
/// `window.confirm` por una llamada al comando `plugin:dialog|confirm` — un
/// comando que esa versión del plugin YA NO registra (lo fusionó en `message`;
/// ver su CHANGELOG). Resultado: cualquier `confirm()` del webview revienta con
/// "command not found". Reinyectamos aquí un override que llama al comando
/// `message` (sí existe) con botones OkCancel. Se registra como plugin propio
/// DESPUÉS de tauri-plugin-dialog para que su script corra el último y gane.
/// Devuelve `Promise<bool>`; el web hace `await confirm(...)` (en navegador
/// normal `await` sobre el bool síncrono nativo también funciona).
const CONFIRM_FIX_JS: &str = r#"
(function () {
  window.confirm = function (message) {
    return window.__TAURI_INTERNALS__
      .invoke('plugin:dialog|message', {
        message: String(message == null ? '' : message),
        buttons: 'OkCancel',
      })
      .then(function (r) { return r === 'Ok' || r === 'Yes' || r === true; });
  };
})();
"#;

/// Empaqueta el override correctivo de `window.confirm` como plugin Tauri.
/// Es genérico sobre el runtime para que `R` se infiera en `.plugin()` (igual
/// que hace `tauri_plugin_dialog::init`): construir el `Builder` inline en
/// `run()` deja el runtime ambiguo y no compila (E0283).
fn confirm_fix_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::<R>::new("confirm-fix")
        .js_init_script(CONFIRM_FIX_JS.to_string())
        .build()
}

/// Consulta al sidecar (ya levantado) si el usuario activó el auto-check de
/// updates en /settings. HTTP plano a localhost por TCP crudo — sin reqwest
/// ni TLS (reqwest+rustls exige un crypto provider y entra en pánico hasta
/// para una GET HTTP simple). Cualquier fallo → false (opt-out por defecto).
fn updater_auto_check_enabled() -> bool {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::Duration;

    let probe = || -> Option<String> {
        let mut s = TcpStream::connect("127.0.0.1:7777").ok()?;
        s.set_read_timeout(Some(Duration::from_secs(3))).ok()?;
        s.write_all(
            b"GET /trpc/settings.get HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
        )
        .ok()?;
        let mut raw = String::new();
        s.read_to_string(&mut raw).ok()?;
        Some(raw)
    };
    // El setting es un booleano; basta buscar su forma serializada en la
    // respuesta — robusto frente a headers / chunked encoding.
    probe()
        .map(|raw| raw.contains("\"updaterAutoCheck\":true"))
        .unwrap_or(false)
}

/// Comprueba si hay una versión nueva publicada y, si la hay, pregunta antes
/// de instalar. Nunca reinicia sin confirmación: un reinicio detiene los
/// watchers de auto-exit activos, así que la decisión es del usuario.
///
/// Opt-in: solo corre si el usuario activó el auto-check en /settings. El
/// check hace un fetch a GitHub (egress de red), así que por defecto no se
/// ejecuta — ver ADR-032 y la auditoría de egress.
async fn check_for_updates(app: tauri::AppHandle) {
    if !updater_auto_check_enabled() {
        return;
    }
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[updater] no configurado: {e}");
            return;
        }
    };
    let update = match updater.check().await {
        Ok(Some(u)) => u,
        Ok(None) => return, // ya está al día
        Err(e) => {
            eprintln!("[updater] check falló: {e}");
            return;
        }
    };
    let approved = app
        .dialog()
        .message(format!(
            "Hay una versión nueva ({}). ¿Instalarla ahora? La app se reiniciará.",
            update.version
        ))
        .title("Actualización disponible")
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show();
    if !approved {
        return;
    }
    // Matar el sidecar JUSTO antes de lanzar el installer NSIS. Sin esto,
    // el .exe del sidecar (que el installer va a sobrescribir) queda
    // bloqueado por el proceso vivo y NSIS aborta con "Error opening file
    // for writing" — bug descubierto al verificar el flujo end-to-end del
    // release de v0.2.0. RunEvent::Exit no se dispara aquí porque el
    // plugin updater hace su propio exit que se salta el handler.
    // Lo metemos en `on_download_finish`: descarga ya completa, instalador
    // a punto de lanzarse, momento mínimo de exposición a "sin sidecar".
    let app_for_finish = app.clone();
    let on_download_finish = move || {
        let handle = app_for_finish.state::<SidecarHandle>();
        let child = handle.0.lock().unwrap().take();
        if let Some(child) = child {
            let _ = child.kill();
            eprintln!("[updater] sidecar killed before installer launch");
        }
    };
    match update
        .download_and_install(|_, _| {}, on_download_finish)
        .await
    {
        Ok(()) => app.restart(),
        Err(e) => eprintln!("[updater] instalación falló: {e}"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        // Debe ir DESPUÉS de tauri-plugin-dialog: su script de init corre tras
        // el del plugin y así nuestro `window.confirm` es el que prevalece.
        .plugin(confirm_fix_plugin())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SidecarHandle::default())
        .setup(|app| {
            // `app_data_dir`: writable, per-OS, para la DB SQLite y el vault.
            //    Windows: %APPDATA%/com.autoexit.desktop
            //    macOS:   ~/Library/Application Support/com.autoexit.desktop
            //    Linux:   $XDG_DATA_HOME/com.autoexit.desktop
            let app_data_dir = strip_verbatim(
                app.path()
                    .app_data_dir()
                    .expect("app_data_dir unavailable"),
            );
            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create app_data_dir");

            // El sidecar es el runtime de Bun; ejecuta el server desplegado en
            // `server-app/` (lo genera `pnpm build:server-binary`).
            //  - dev (`tauri dev`): server-app/ se lee de `binaries/` vía
            //    CARGO_MANIFEST_DIR, sin pasar por el mecanismo de resources.
            //  - release: se resuelve desde `resource_dir()`. El empaquetado
            //    real de server-app (paths largos / aplanado) es de F4.2.
            let server_app_dir = if cfg!(debug_assertions) {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("binaries")
                    .join("server-app")
            } else {
                strip_verbatim(
                    app.path()
                        .resource_dir()
                        .expect("resource_dir unavailable"),
                )
                .join("binaries")
                .join("server-app")
            };
            let server_entry = server_app_dir.join("src").join("main.ts");
            let migrations_dir = server_app_dir.join("drizzle");

            let db_path = app_data_dir.join("auto-exit.db");
            let vault_path = app_data_dir.join("wallet.vault");

            // Log del sidecar a fichero: en release la app es GUI sin consola,
            // así que el stdout/stderr del server se perdería. Persistirlo en
            // app_data es la única vía de depurar la app instalada.
            let sidecar_log = app_data_dir.join("sidecar.log");
            let _ = std::fs::write(
                &sidecar_log,
                format!(
                    "[setup] server_entry={} (exists={})\n[setup] migrations={} (exists={})\n",
                    server_entry.display(),
                    server_entry.exists(),
                    migrations_dir.display(),
                    migrations_dir.exists(),
                ),
            );

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

            // Drenamos stdout/stderr del sidecar a la consola (visible en
            // `tauri dev`) y a `sidecar.log` (única vía de depurar la app
            // release, que es GUI sin consola). Cuando el server anuncia que
            // ya escucha, lanzamos el check de updates — que primero consulta
            // el setting opt-in a través del propio sidecar.
            let updater_app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use std::io::Write;
                use tauri_plugin_shell::process::CommandEvent;
                let mut updater_started = false;
                while let Some(event) = rx.recv().await {
                    let line = match event {
                        CommandEvent::Stdout(b) => {
                            format!("[stdout] {}", String::from_utf8_lossy(&b))
                        }
                        CommandEvent::Stderr(b) => {
                            format!("[stderr] {}", String::from_utf8_lossy(&b))
                        }
                        CommandEvent::Terminated(p) => {
                            format!("[terminated] code={:?} signal={:?}", p.code, p.signal)
                        }
                        CommandEvent::Error(e) => format!("[error] {}", e),
                        _ => continue,
                    };
                    let line = line.trim_end();
                    println!("[sidecar] {}", line);
                    if let Ok(mut f) = std::fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(&sidecar_log)
                    {
                        let _ = writeln!(f, "{}", line);
                    }
                    // El server ya escucha → el sidecar puede responder a la
                    // consulta del setting. Disparamos el check una sola vez.
                    if !updater_started && line.contains("listening on http") {
                        updater_started = true;
                        tauri::async_runtime::spawn(check_for_updates(
                            updater_app.clone(),
                        ));
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
