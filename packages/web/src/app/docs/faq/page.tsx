import Link from "next/link";
import { ArticleHeader } from "../_components/ArticleHeader";
import { articleBySlug } from "../_components/articles";

const article = articleBySlug("/docs/faq")!;

export default function Faq() {
  return (
    <div className="space-y-10">
      <ArticleHeader article={article} />

      <section className="space-y-10">
        <Q title="Why doesn't this work like Phantom or any other dApp connect?">
          Phantom-style connect signs one transaction at a time, with you
          present to approve each. An auto-exit fires when price hits a
          trigger — which might be at 3 AM. The bot needs a key it can use
          autonomously, which means an encrypted local copy of a key, not a
          wallet adapter. We can&apos;t hide this trade-off; we make it
          explicit and bound the scope.{" "}
          <Link
            href="/docs/bot-wallet"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            More on the bot wallet model →
          </Link>
        </Q>

        <Q title="Can I use this on mainnet?">
          The code supports it, but mainnet has guard rails: dry-run is on by
          default, and switching it off plus selecting mainnet requires an
          explicit{" "}
          <code className="t-num text-[var(--color-text)]">
            ALLOW_MAINNET_LIVE=true
          </code>{" "}
          env var. The intent is to make &ldquo;accidentally signed with real
          money&rdquo; impossible. Today the public release still targets
          devnet for new users; mainnet is for people who&apos;ve read the
          code or tested with simulation.
        </Q>

        <Q title="What happens if Solana congests and the close tx fails?">
          The runner retries with exponential backoff (5 attempts: 1s, 2s, 4s,
          8s, 16s). Each retry rebuilds the transaction with a fresh
          blockhash. If everything fails the task moves to{" "}
          <code className="t-num text-[var(--color-text)]">error</code> and
          you decide whether to restart it. The price is still being watched
          for the duration of those retries — the runner is one bot, but it
          can&apos;t fire multiple closes at once for the same task.
        </Q>

        <Q title="Can I run this on a VPS so I don't have to keep my laptop on?">
          Yes, but: the server binds localhost only, so accessing the UI from
          your laptop means SSH-tunneling or putting the box on a private
          network you control (Tailscale, Cloudflare Tunnel). Do not open the
          port to the internet — anyone who reaches it while the vault is
          unlocked can ask it to sign.
        </Q>

        <Q title="What if I lose the passphrase?">
          You can&apos;t recover the encrypted vault from this server. The
          way out is to delete the vault file from the wallet page (under
          Danger zone) and re-import the same secret if you saved it
          somewhere else (your password manager, Phantom/Backpack). The
          wallet on-chain is unaffected — it still holds your assets, you
          just need the key again to sign for them.
        </Q>

        <Q title="What about Meteora, Raydium, Jupiter LP, others?">
          The codebase is built around a{" "}
          <code className="t-num text-[var(--color-text)]">ProtocolAdapter</code>{" "}
          contract so adding a protocol is mostly a matter of writing one
          module. Orca is in v1 because it&apos;s where we started. Meteora
          DLMM is the next one on the list.
        </Q>

        <Q title="Why is the exit token limited to one of the pool's tokens?">
          To keep v1 simple and dependency-free. Routing through an
          aggregator (Jupiter, Titan) adds a moving piece — quote
          freshness, multi-hop, devnet liquidity gaps. The same-pool ExactIn
          swap is one tx on the same SDK we already use. We&apos;ll add
          aggregator routing once it pulls its weight; the simpler model
          covers the common &ldquo;close + cash out to USDC&rdquo; case
          today.
        </Q>

        <Q title="Is the source code open?">
          The plan is yes, MIT, before the public Tauri release. Until then
          the repo is private while the rough edges get smoothed.
        </Q>
      </section>
    </div>
  );
}

function Q({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hairline-t pt-8 first:pt-0 first:border-t-0">
      <h3 className="t-h3 text-[var(--color-text)]">{title}</h3>
      <p className="mt-3 t-body text-[var(--color-text-muted)]">{children}</p>
    </div>
  );
}
