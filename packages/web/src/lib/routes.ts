// Helpers de navegación a las vistas de detalle.
//
// En el static export de Tauri las rutas dinámicas (`/positions/[mint]`,
// `/tasks/[id]`) solo existen como el placeholder `_` — navegar a un id real
// en el path no resuelve en HTML estático (no hay server que lo renderice).
// Por eso el id viaja como query string sobre la ruta placeholder, y la vista
// lo lee con `useSearchParams()`. Centralizado aquí para no repetir el patrón
// (no obvio) en cada enlace.

export function positionDetailHref(mint: string): string {
  return `/positions/_?mint=${encodeURIComponent(mint)}`;
}

export function taskDetailHref(id: string): string {
  return `/tasks/_?id=${encodeURIComponent(id)}`;
}
