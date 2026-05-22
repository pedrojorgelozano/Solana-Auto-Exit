// Server Component shim para Next.js static export.
//
// `output: 'export'` (modo Tauri) exige que las dynamic routes tengan un
// `generateStaticParams`; aquí devuelve un único placeholder `_`, que se
// materializa como HTML estático en `out/positions/_/`. La navegación real
// NO usa el path: el `mint` viaja como query string sobre esa ruta
// placeholder (`/positions/_?mint=...`, ver `lib/routes.ts`) y `./client.tsx`
// lo lee con `useSearchParams()`. Navegar a `/positions/<mint-real>` no
// resolvería en el HTML estático.
//
// En desarrollo (sin `TAURI_BUILD=1`) Next.js sirve la ruta con normalidad.

import { Suspense } from "react";

import PositionPage from "./client";

export function generateStaticParams(): { mint: string }[] {
  return [{ mint: "_" }];
}

export const dynamicParams = false;

export default function Page(): React.ReactElement {
  // `useSearchParams()` en `client.tsx` exige un boundary de Suspense para
  // que el export estático pueda prerenderar el shell.
  return (
    <Suspense>
      <PositionPage />
    </Suspense>
  );
}
