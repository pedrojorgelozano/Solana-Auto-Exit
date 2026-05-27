"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ui] uncaught error", error);
  }, [error]);

  return (
    <main className="mr-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-20">
      <div className="t-eyebrow text-[var(--color-danger)]">Error</div>
      <h1 className="mt-4 t-display">Something broke.</h1>
      <p className="mt-6 max-w-md t-body text-[var(--color-text-muted)]">
        The page didn&apos;t render. The detail below is the raw error from
        the runtime — paste it in an issue if it keeps happening.
      </p>

      <pre className="mt-6 max-w-2xl overflow-auto border-l-2 border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-4 t-num text-xs text-[var(--color-text)]">
        {error.message}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>

      <div className="mt-8 flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Link href="/">
          <Button variant="secondary">Home</Button>
        </Link>
      </div>
    </main>
  );
}
