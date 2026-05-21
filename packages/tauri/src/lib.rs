// Entry point del shell Tauri. Por convención v2, el grueso de la app
// vive en una lib crate y main.rs es solo el wrapper. Esto deja la
// puerta abierta a F4-mobile si algún día nos da por ahí, sin tener
// que reorganizar el código.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            // F4.1.b: aquí lanzaremos el sidecar del server. Por ahora
            // el shell solo carga el frontend; el server hay que
            // arrancarlo a mano (`pnpm dev:server` en otra terminal).
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
