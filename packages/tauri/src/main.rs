// En Windows, sin esto la consola se quedaría abierta junto a la ventana
// del app — feo. En dev (debug build) la mantenemos abierta para ver logs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    solana_auto_exit_tauri_lib::run()
}
