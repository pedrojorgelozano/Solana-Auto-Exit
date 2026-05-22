// Server Component shim para Next.js static export.
// Misma técnica que `app/positions/[mint]/page.tsx`. Ver comentario allí:
// el `id` real viaja como query string (`/tasks/_?id=...`, ver lib/routes.ts)
// y `./client.tsx` lo lee con `useSearchParams()`.

import { Suspense } from "react";

import TaskPage from "./client";

export function generateStaticParams(): { id: string }[] {
  return [{ id: "_" }];
}

export const dynamicParams = false;

export default function Page(): React.ReactElement {
  return (
    <Suspense>
      <TaskPage />
    </Suspense>
  );
}
