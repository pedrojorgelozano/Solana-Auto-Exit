import { ArticleHeader } from "../_components/ArticleHeader";
import { articleBySlug } from "../_components/articles";

const article = articleBySlug("/docs/operational")!;

export default function Operational() {
  return (
    <div className="space-y-10">
      <ArticleHeader article={article} />

      <section>
        <h2 className="t-h2">Lock and unlock</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The vault has two states: locked (key is on disk, encrypted) and
          unlocked (key is also in memory, decrypted with your passphrase).
          The bot can only sign while unlocked. Locking is a single click
          from the wallet page; the in-memory key is overwritten and the
          encrypted file on disk is untouched.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          There&apos;s no auto-lock by inactivity today. If you walk away
          and want the bot to stop signing, lock manually.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Restarts and pauses</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The server can restart for many reasons — OS reboot, a deploy, a
          crash. When that happens, the in-memory state is gone. To prevent
          surprise behavior:
        </p>
        <ul className="mt-4 space-y-2 t-body text-[var(--color-text-muted)]">
          <li>
            Any task that was active (idle, armed, triggered, closing) is
            marked <code className="t-num text-[var(--color-text)]">paused</code> at boot with a
            note saying the server restarted.
          </li>
          <li>
            The vault starts locked. Nothing signs until you unlock.
          </li>
          <li>
            After unlock, you resume each paused task explicitly. The bot
            does not auto-resume — recovery from an unknown state is your
            decision.
          </li>
        </ul>
        <p className="mt-4 t-body text-[var(--color-text-muted)]">
          Locking while tasks are running also pauses them: the watcher
          loops abort and the tasks move to{" "}
          <code className="t-num text-[var(--color-text)]">paused</code> with{" "}
          <em>vault was locked while running</em> as the reason.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Errors during close</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Close and swap are two separate transactions on Solana. The runner
          retries each with backoff (5 attempts, exponential). Three failure
          shapes worth knowing:
        </p>
        <ul className="mt-4 space-y-3 t-body text-[var(--color-text-muted)]">
          <li>
            <span className="text-[var(--color-text)]">Close fails.</span> The
            position is still open. The task moves to{" "}
            <code className="t-num text-[var(--color-text)]">error</code>.
            Restart the task to retry, or fix whatever broke (RPC, balance,
            congestion).
          </li>
          <li>
            <span className="text-[var(--color-text)]">Close succeeds, swap fails.</span>{" "}
            The close tx hash is kept on the task row. You hold the underlying
            tokens at the bot wallet; the swap can be retried later or just
            skipped.
          </li>
          <li>
            <span className="text-[var(--color-text)]">Confirmation timeout.</span>{" "}
            Rare. The retry path will re-construct the tx with a fresh
            blockhash; if that also fails, the task errors and you check the
            tx on-chain manually before deciding.
          </li>
        </ul>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Backups and recovery</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The encrypted vault file lives in the server&apos;s data directory
          (<code className="t-num text-[var(--color-text)]">packages/server/data/</code> in dev,{" "}
          <code className="t-num text-[var(--color-text)]">/app/data/</code>{" "}
          inside the Docker container — bind-mounted to the host). If you
          lose that file you also lose the encrypted key — but the key
          itself is still recoverable from anywhere else you stored the
          secret (your password manager, or Phantom/Backpack if you imported
          it there). The wallet on-chain is unaffected by anything that
          happens to this server.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          A simple file copy of the data directory is a complete backup. The
          SQLite database that lives next to the vault keeps tasks, history,
          and settings.
        </p>
      </section>
    </div>
  );
}
