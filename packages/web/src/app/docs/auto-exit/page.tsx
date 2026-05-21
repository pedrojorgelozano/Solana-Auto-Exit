import { ArticleHeader } from "../_components/ArticleHeader";
import { articleBySlug } from "../_components/articles";

const article = articleBySlug("/docs/auto-exit")!;

export default function AutoExit() {
  return (
    <div className="space-y-10">
      <ArticleHeader article={article} />

      <section id="triggers">
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

      <section id="time-buffer" className="hairline-t pt-10">
        <h2 className="t-h2">Time buffer</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          By default a trigger fires the moment a poll reads a price across
          the target. The <strong className="text-[var(--color-text)]">time
          buffer</strong> changes that: it requires the price to{" "}
          <em>stay</em> on the wrong side of the target for the configured
          duration before the bot closes. Useful for filtering out brief
          spikes that you wouldn&apos;t want to react to — a 5-minute pump
          that reverts, an oracle hiccup after a sandwich attack.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Each trigger has its own buffer (TP and SL independently). Presets
          in the configure form: <code className="t-num text-[var(--color-text)]">off / 6h / 12h / 1d / 3d / 7d</code>.{" "}
          The default is <code className="t-num text-[var(--color-text)]">off</code>{" "}
          (fire on first cross, same as legacy behavior).
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The reset is <strong className="text-[var(--color-text)]">hard</strong>: if at any tick during the
          buffer the price leaves the trigger zone, the cronómetro resets to
          zero. When the price crosses again, the buffer starts over from
          scratch. This matches the literal meaning of &ldquo;the price must
          hold&rdquo; — if it didn&apos;t hold, it doesn&apos;t qualify.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The cronómetro lives in memory only. If the server restarts
          mid-buffer, the timer resets — the watcher resumes from{" "}
          <code className="t-num text-[var(--color-text)]">paused</code> with a fresh buffer. Conservative
          choice: a server that was down can&apos;t honestly claim that the
          price was holding the whole time.
        </p>
      </section>

      <section id="slippage" className="hairline-t pt-10">
        <h2 className="t-h2">Slippage tolerance</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          When the close transaction is built, the SDK quotes the expected
          token amounts at the current pool state. Between submission and
          execution the pool can move; if it moves more than your slippage
          tolerance allows, the on-chain instruction reverts to protect you
          from a worse-than-expected fill.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Presets in the form and in{" "}
          <a
            href="/settings"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            /settings
          </a>: <code className="t-num text-[var(--color-text)]">0.5% / 1% / 2% / 5%</code>. <strong className="text-[var(--color-text)]">1%</strong>{" "}
          is the default and works for most pairs in normal volatility. Lower
          gives stricter price guarantees but reverts more often;{" "}
          higher completes more reliably but accepts a wider band.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Slippage on the exit-swap (when configured) is independent — see{" "}
          <a
            href="#exit-token"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            Exit token
          </a>
          .
        </p>
      </section>

      <section id="exit-token" className="hairline-t pt-10">
        <h2 className="t-h2">Exit token</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          A close on Orca returns whatever mix of tokens the position holds at
          that moment — typically heavily skewed to one side when out of
          range. If you want a clean exit into a single token (USDC, for
          instance), set an exit token: after the close, the bot swaps the
          proceeds on the same pool using ExactIn.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The close and the swap are two separate transactions; if the swap
          fails, the close is still good — you keep the underlying tokens at
          the bot wallet and can retry the swap or move on. The exit-swap
          slippage budget is independent from the close slippage.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Today the exit token must be one of the two tokens of the pool —
          we don&apos;t route through aggregators in v1. So for a SOL/USDC
          position you can exit to either SOL or USDC, not to USDT.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Validating before committing real funds</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The preferred way to validate an auto-exit setup is to switch the
          network to <strong className="text-[var(--color-text)]">TEST</strong>{" "}
          (Solana devnet) from{" "}
          <a
            href="/settings"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            /settings
          </a>
          . The bot then runs the exact same code path against devnet,
          signing real transactions against the test chain — same retries,
          same slippage logic, same time buffer. No real money involved.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          A legacy <em>dry-run</em> flag still exists in the schema (per-task
          boolean) and the engine honors it by quoting + skipping the
          transaction signing. The UI toggle for it is hidden today — the
          network toggle is the cleaner mental model. If you need dry-run
          specifically (e.g. validating against mainnet prices without
          spending), it can be re-enabled in the configure form with a
          one-line code change.
        </p>
      </section>

      <section id="polling-interval" className="hairline-t pt-10">
        <h2 className="t-h2">Polling interval</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Default poll is every 30 seconds — a cautious sweet spot between
          responsiveness and RPC cost. Change it server-wide in{" "}
          <a
            href="/settings"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            /settings
          </a>{" "}
          with a written explanation of each preset. Going lower (e.g. 10 s)
          burns through Helius free tier quickly; going higher (1 min, 5 min)
          is fine when you&apos;re using time buffers, since the buffer wait
          dwarfs the polling cadence anyway.
        </p>
      </section>

      <section id="when-the-close-fails" className="hairline-t pt-10">
        <h2 className="t-h2">When the close fails</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The trigger fires and the bot submits a close transaction. The most
          common reason for that transaction to fail is{" "}
          <strong className="text-[var(--color-text)]">slippage</strong> —
          the pool moved more between the quote and the execution than your
          slippage tolerance allows, and Orca / Meteora revert the
          instruction to protect you from a worse-than-expected fill.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Before giving up the bot retries{" "}
          <strong className="text-[var(--color-text)]">five times</strong> with
          exponential backoff (1 s → 2 s → 4 s → 8 s → 16 s, ~31 s total).
          Each retry rebuilds the transaction with a fresh quote and a fresh
          blockhash, so if the pool settles between attempts a later try can
          still succeed. If all five fail, the task moves to{" "}
          <code className="t-num text-[var(--color-text)]">error</code> with
          the last message stored on the row.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          <strong className="text-[var(--color-text)]">
            Your position is unchanged.
          </strong>{" "}
          A reverted close never moved tokens — the position NFT still owns
          the same liquidity it did before the trigger. The auto-exit just
          stops watching it; you decide what to do next.
        </p>

        <h3 className="mt-8 t-h3">Recovering from a slippage error</h3>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Open the auto-exit page (any error row links there). The error
          message will mention <em>slippage</em> or <em>tolerance</em>; the
          page detects this and surfaces a Recovery panel with the path:
        </p>
        <ol className="mt-4 ml-5 list-decimal space-y-2 t-body text-[var(--color-text-muted)]">
          <li>
            <strong className="text-[var(--color-text)]">
              Delete the failed auto-exit
            </strong>{" "}
            from its detail page (the row is dead anyway).
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              Configure a new one
            </strong>{" "}
            on the same position with higher slippage tolerance (2% instead of
            1%, or 5% for very volatile pairs).
          </li>
        </ol>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Live tasks are immutable by design (per{" "}
          <a
            href="/docs/operational"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            ADR-013
          </a>{" "}
          — the configuration is a snapshot at creation, no mid-life edits).
          Delete + recreate is the supported way to change slippage, exit
          token, or any other parameter that froze when you armed the
          watcher.
        </p>

        <h3 className="mt-8 t-h3">Other failure modes</h3>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Errors that aren&apos;t slippage-related are usually transient: RPC
          timeouts, network congestion, a token account being closed between
          ticks. For those, hitting{" "}
          <strong className="text-[var(--color-text)]">Restart</strong> on the
          task page often resolves it — the next attempt builds a fresh
          transaction and Solana finality plays nicer once the chain
          un-congests. If a non-slippage error keeps returning across multiple
          restarts, treat it as structural: delete and reconfigure, or open
          an issue if you can&apos;t identify the cause.
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
