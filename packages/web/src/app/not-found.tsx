import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-20">
      <div className="t-eyebrow text-[var(--color-text-muted)]">404</div>
      <h1 className="mt-4 t-display">Page not found.</h1>
      <p className="mt-6 max-w-md t-body text-[var(--color-text-muted)]">
        The thing you&apos;re looking for isn&apos;t in this server&apos;s
        records. Maybe it was a deleted task, or a position no longer in
        the wallet.
      </p>
      <div className="mt-8">
        <Link href="/">
          <Button>Back to dashboard →</Button>
        </Link>
      </div>
    </main>
  );
}
