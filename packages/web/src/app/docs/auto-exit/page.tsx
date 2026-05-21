import { ArticleHeader } from "../_components/ArticleHeader";
import { articleBySlug } from "../_components/articles";

const article = articleBySlug("/docs/auto-exit")!;

export default function AutoExit() {
  return (
    <div className="space-y-10">
      <ArticleHeader article={article} />

      <section>
        <h2 className="t-h2">Take-profit, stop-loss, or both</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          A single auto-exit can carry a take-profit price, a stop-loss
          price, or both. At each tick the bot evaluates the pool&apos;s
          current price against your thresholds:
        </p>
        <ul className="mt-4 space-y-2 t-body text-[var(--color-text-muted)]">
          <li>
            <span className="text-[var(--color-text)]">price ≥ TP</span> → close (take-profit).
          </li>
          <li>
            <span className="text-[var(--color-text)]">price ≤ SL</span> → close (stop-loss).
          </li>
        </ul>
        <p className="mt-4 t-body text-[var(--color-text-muted)]">
          If both fire in the same tick (rare, but possible if price gaps
          through the band between two polls), take-profit wins. The reason
          for the trigger is recorded on the task row for the ledger.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The configure form validates that you set at least one of the two
          and that TP &gt; SL when both are set, so you can&apos;t define a
          band that would fire immediately.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Slippage and the exit-token swap</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          A close on Orca returns whatever mix of tokens the position holds at
          that moment — typically heavily skewed to one side when out of
          range. If you want a clean exit into a single token (USDC, for
          instance), set an exit token: after the close, the bot swaps the
          proceeds on the same pool using ExactIn.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The slippage budget (basis points, default 100 = 1%) caps how far
          the realized price can drift from the quote before the swap fails.
          The close and the swap are two separate transactions; if the swap
          fails, the close is still good — you keep the underlying tokens at
          the bot wallet and can retry the swap or move on.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Today the exit token must be one of the two tokens of the pool —
          we don&apos;t route through aggregators in v1. So for a SOL/USDC
          position you can exit to either SOL or USDC, not to USDT.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Dry-run simulation</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Toggle simulation on at configure time and the bot will go through
          the whole lifecycle — poll prices, detect the trigger, quote the
          close and the swap — but stop short of sending transactions. The
          task moves to <code className="t-num text-[var(--color-text)]">done</code> with the would-be
          outcome in the receipt instead of real transaction hashes.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Use it once to convince yourself the prices, slippage, and exit
          token are configured the way you expect. Real auto-exits need
          simulation off.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Polling interval and retry</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Default poll is every 5 seconds. You can override per-task in the
          advanced section. On RPC errors the bot retries with exponential
          backoff (5 attempts, base 1s) — typically enough to ride out
          Solana congestion or a flaky RPC. If all retries fail, the task
          moves to <code className="t-num text-[var(--color-text)]">error</code> with the last
          message; you can restart it manually from the task page.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">One auto-exit per position</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          A position can only be closed once, so the UI prevents you from
          stacking multiple active auto-exits on the same position. When you
          land on a position page that already has an active watcher, you
          see its current state instead of the configure form. Stopping or
          completing the auto-exit frees the position for a new one.
        </p>
      </section>
    </div>
  );
}
