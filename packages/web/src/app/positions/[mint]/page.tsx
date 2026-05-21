// Server Component shim para habilitar Next.js static export.
//
// `output: 'export'` (modo Tauri) exige que las dynamic routes tengan un
// `generateStaticParams` que devuelva al menos un path; ese path se materializa
// como HTML estático en `out/positions/<placeholder>/index.html`. El verdadero
// `mint` se lee client-side vía `useParams()` en `./client.tsx`, así que el
// placeholder es solo el shell que se hidrata con el contenido real al cargar.
//
// En desarrollo (sin `TAURI_BUILD=1`), Next.js renderiza la ruta normalmente
// y `generateStaticParams` se ignora — el dev server resuelve cada mint en
// caliente como hasta ahora.

import PositionPage from "./client";

export function generateStaticParams(): { mint: string }[] {
  return [{ mint: "_" }];
}

export const dynamicParams = false;

export default function Page(): React.ReactElement {
  return <PositionPage />;
}
