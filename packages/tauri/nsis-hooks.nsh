; NSIS installer hooks for Auto-Exit.
;
; Why: the app runs a background sidecar (auto-exit-server.exe). When the
; auto-updater downloads a new installer and runs it, that sidecar is still
; alive and holds an open handle on its own .exe — the very file the installer
; must overwrite — so NSIS aborts with "Error opening file for writing".
;
; The Rust side already kills the sidecar in `on_download_finish`
; (packages/tauri/src/lib.rs), but that only helps when the *old* app
; performing the update carries that code (v0.3.0+). Builds that predate it
; (v0.2.0 and earlier) can't kill their sidecar, so their auto-update to a
; newer version still fails.
;
; This preinstall hook travels in the NEW installer and kills the sidecar
; before any file is overwritten — so it protects the update regardless of
; which (possibly fix-less) version is being upgraded from. Belt-and-suspenders
; with the Rust-side kill; together they make auto-update robust against this
; class of file-lock failure.

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping the Auto-Exit background service before install..."
  ; /F force, /T also terminate child processes. Ignore the return code:
  ; the process may simply not be running (fresh install), which is fine.
  nsExec::Exec 'taskkill /F /T /IM auto-exit-server.exe'
  Pop $0
  ; Give Windows a moment to release the file handle after the kill before
  ; NSIS starts overwriting files.
  Sleep 800
!macroend
