// Server Component shim para habilitar Next.js static export.
// Misma técnica que `app/positions/[mint]/page.tsx`. Ver comentario allí.

import TaskPage from "./client";

export function generateStaticParams(): { id: string }[] {
  return [{ id: "_" }];
}

export const dynamicParams = false;

export default function Page(): React.ReactElement {
  return <TaskPage />;
}
