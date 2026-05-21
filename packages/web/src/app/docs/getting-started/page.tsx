import Link from "next/link";
import { ArticleHeader } from "../_components/ArticleHeader";
import { articleBySlug } from "../_components/articles";

const article = articleBySlug("/docs/getting-started")!;

export default function GettingStarted() {
  return (
    <div className="space-y-10">
      <ArticleHeader article={article} />

      <section>
        <h2 className="t-h2">01 · Set up the bot wallet</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The bot needs a Solana account whose key it can use to sign close
          transactions. From the home page or the wallet chip in the header,
          open the setup modal. You have three paths:
        </p>
        <ul className="mt-4 space-y-3 t-body text-[var(--color-text-muted)]">
          <li>
            <strong className="text-[var(--color-text)]">Generate</strong> —
            a fresh keypair created on this machine. Best when you don&apos;t
            already keep a dedicated operational account.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">Import key</strong> —
            paste the private key of a single existing account (the one Phantom
            or Backpack exports per-account, not a seed phrase). Use a hot /
            operational account, not the one with your cold holdings.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              Advanced · JSON
            </strong>{" "}
            — a Solana CLI <code className="t-num text-[var(--color-text)]">wallet.json</code> array. Same scope as Import key.
          </li>
        </ul>
        <p className="mt-4 t-body text-[var(--color-text-muted)]">
          Whichever path you pick, the server encrypts the key with the
          passphrase you set and writes it to disk. The key is decrypted in
          memory only while the wallet is unlocked.{" "}
          <Link
            href="/docs/bot-wallet"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            More on the three paths →
          </Link>
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">02 · Fund the wallet and get a position into it</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The bot can only close positions whose NFT this address holds. There
          are two practical ways to put one there:
        </p>
        <ul className="mt-4 space-y-3 t-body text-[var(--color-text-muted)]">
          <li>
            <strong className="text-[var(--color-text)]">
              Open positions from the bot account.
            </strong>{" "}
            The base58 secret we generate is exactly what Phantom and Backpack
            accept under &ldquo;Import private key.&rdquo; Add the bot wallet
            there as a new account, switch to it, and open an LP on Orca
            normally. The NFT lands at the bot wallet.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              Transfer an existing position NFT.
            </strong>{" "}
            From whatever account currently owns a Whirlpool position, send
            the position NFT to the bot wallet address. Ownership moves; the
            bot can now close it.
          </li>
        </ul>
        <p className="mt-4 t-body text-[var(--color-text-muted)]">
          Either way, leave a small amount of SOL in the bot wallet for close
          + optional swap fees. A few cents&apos; worth is usually enough.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">03 · Configure an auto-exit</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          On the positions page, pick one and set up a trigger. You can give
          it a take-profit price, a stop-loss price, or both — whichever
          hits first wins. Optionally, choose an exit token: after the close,
          the bot will swap the proceeds into the token you picked (must be
          one of the two tokens of the pool).
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Run it in <em>simulation</em> mode first if you want to see what
          would happen without spending real SOL — the bot will reach the
          quote step and report the would-be outcome instead of sending the
          transaction.{" "}
          <Link
            href="/docs/auto-exit"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            More on triggers, slippage, and simulation →
          </Link>
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Then nothing — that&apos;s the point.</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The bot polls the pool price every few seconds and acts when one of
          your triggers crosses. You can close the tab, close your laptop, do
          whatever — the server keeps watching as long as the wallet is
          unlocked. To stop, pause, or rearm an auto-exit, open it from the
          tasks page.
        </p>
      </section>
    </div>
  );
}
