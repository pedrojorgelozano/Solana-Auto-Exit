import { ArticleHeader } from "../_components/ArticleHeader";
import { articleBySlug } from "../_components/articles";

const article = articleBySlug("/docs/security")!;

export default function Security() {
  return (
    <div className="space-y-10">
      <ArticleHeader article={article} />

      <section>
        <h2 className="t-h2">Threat model in one paragraph</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          This is a self-hosted tool. It assumes the machine running it is
          yours, the network it listens on is yours, and nobody else can
          read its filesystem. Under that assumption it provides convenient
          autonomous signing for one specific account&apos;s key. If those
          assumptions break, the worst case is the loss of whatever assets
          that single account holds — by design, never more than that.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">What&apos;s where</h2>
        <ul className="mt-3 space-y-3 t-body text-[var(--color-text-muted)]">
          <li>
            <span className="text-[var(--color-text)]">On disk.</span> The
            encrypted vault file — your key encrypted with{" "}
            <code className="t-num text-[var(--color-text)]">
              scrypt(N=32768, r=8, p=1)
            </code>{" "}
            + <code className="t-num text-[var(--color-text)]">AES-256-GCM</code>.
            File permissions{" "}
            <code className="t-num text-[var(--color-text)]">0600</code> on
            Unix; written atomically. The address is stored in clear next to
            the ciphertext as a sanity check during unlock.
          </li>
          <li>
            <span className="text-[var(--color-text)]">In memory.</span> The
            decrypted key, only while the vault is unlocked. Locked again on
            explicit lock, on process exit, or on signal (SIGINT/SIGTERM).
          </li>
          <li>
            <span className="text-[var(--color-text)]">On the wire.</span>{" "}
            Nothing outside this machine — by default. The server listens on{" "}
            <code className="t-num text-[var(--color-text)]">127.0.0.1</code>{" "}
            only; nothing on the LAN can connect.
          </li>
        </ul>
      </section>

      <section id="hot-wallet-tradeoff" className="hairline-t pt-10">
        <h2 className="t-h2">Running 24/7 vs. locking when away</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          This tool signs autonomously, so the key needs to be decrypted
          in RAM while the bot is operating. That is the same model
          Phantom and Backpack use while you have them unlocked — the
          difference is that the bot stays unlocked longer because that
          is what makes it useful at 3am.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          You have two reasonable postures:
        </p>
        <ul className="mt-4 space-y-3 t-body text-[var(--color-text-muted)]">
          <li>
            <span className="text-[var(--color-text)]">
              Unlocked, 24/7 coverage.
            </span>{" "}
            Triggers fire whether you are at the computer or not. The key
            lives in RAM the whole time the wallet is unlocked. For a
            compromise to leak the key, something with elevated privileges
            (malware, a memory dump) would need to run on this machine —
            in which case Phantom and the rest of your wallets are equally
            exposed. We bind the API to{" "}
            <code className="t-num text-[var(--color-text)]">127.0.0.1</code>{" "}
            so only local processes can talk to the bot.
          </li>
          <li>
            <span className="text-[var(--color-text)]">
              Lock when you are away for a long stretch.
            </span>{" "}
            The key is removed from RAM and active auto-exits pause until
            you unlock again. Useful if you will be off the machine for
            days and prefer the bot to stop watching during that time. The
            cost is that any trigger that fires while locked is missed —
            the watcher resumes from the current price, not from where it
            was when you locked.
          </li>
        </ul>
        <p className="mt-4 t-body text-[var(--color-text-muted)]">
          <span className="text-[var(--color-text)]">
            Practical guidance:
          </span>{" "}
          treat the bot wallet as a hot operational account — only fund it
          with what you are actively trading, not your cold holdings.
          That single rule keeps the blast radius bounded if anything ever
          goes wrong. For most users, leaving the wallet unlocked while
          the bot operates is a reasonable trade-off, the same as anyone
          who keeps Phantom open while they browse DeFi.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Network bind: localhost-only</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The server binds <code className="t-num text-[var(--color-text)]">127.0.0.1</code>{" "}
          by default. The Next.js dev server, the Hono server, and the Docker
          host port all enforce this. The reason: an unlocked vault means any
          process that can reach the HTTP endpoint can ask the bot to sign.
          Limiting that to local processes contains the surface to whoever can
          run code on this machine.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Exposing the server to other devices (your phone, a remote shell)
          is a future option that requires a token-of-pairing and ideally a
          private tunnel (Tailscale, Cloudflare Tunnel) — not opening ports
          to the internet.
        </p>
      </section>

      <section id="mainnet-gate" className="hairline-t pt-10">
        <h2 className="t-h2">Switching to real mode</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The network toggle in{" "}
          <a
            href="/settings"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            /settings
          </a>{" "}
          lets you switch between <em>test</em> (Solana devnet) and{" "}
          <em>real</em> (Solana mainnet) at any time. Clicking <strong className="text-[var(--color-text)]">REAL</strong>{" "}
          opens an inline confirmation panel — you must check{" "}
          <em>&ldquo;I understand this will sign with real funds&rdquo;</em>{" "}
          and click <em>Confirm · use real funds</em>. That two-step click is
          the safety net.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Originally (ADR-006) the switch was double-gated: the env var{" "}
          <code className="t-num text-[var(--color-text)]">ALLOW_MAINNET_LIVE=true</code>{" "}
          had to be set at server start, AND the UI confirmation. With the
          tool stabilized and self-hosted by people who know what they&apos;re
          doing, the env-var gate became friction without a useful payoff
          — superseded by{" "}
          <a
            href="/docs/operational"
            className="text-[var(--color-accent-bright)] hover:underline"
          >
            ADR-026
          </a>
          . The env var is now opt-OUT: set{" "}
          <code className="t-num text-[var(--color-text)]">ALLOW_MAINNET_LIVE=false</code>{" "}
          if you want the CLI path to refuse mainnet (useful for unattended
          scripts / CI).
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Existing tasks keep the network they were created with — switching
          to real doesn&apos;t migrate them. Only new auto-exits configured
          after the switch will run on mainnet.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Cryptography choices</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The KDF is scrypt and the cipher is AES-256-GCM, both from Node&apos;s{" "}
          <code className="t-num text-[var(--color-text)]">node:crypto</code> —
          zero external dependencies for the wallet cipher. The same family
          used by Solana CLI and Phantom. GCM&apos;s authentication tag
          detects passphrase mistakes cleanly: a wrong passphrase fails
          fast, doesn&apos;t silently return garbage.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Argon2id would be slightly more resistant to GPU/ASIC attacks at
          equivalent parameters; for a user passphrase guarding a local
          wallet, the practical difference is negligible compared to the
          impact of a weak passphrase.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">What can still go wrong</h2>
        <ul className="mt-3 space-y-3 t-body text-[var(--color-text-muted)]">
          <li>
            <span className="text-[var(--color-text)]">Weak passphrase.</span>{" "}
            scrypt slows offline attacks but doesn&apos;t make them
            impossible. Use a long, random passphrase from a password manager.
          </li>
          <li>
            <span className="text-[var(--color-text)]">
              Malware on the host.
            </span>{" "}
            If something on your machine can read process memory while the
            wallet is unlocked, it can extract the key. Locking when not
            actively monitoring narrows that window.
          </li>
          <li>
            <span className="text-[var(--color-text)]">
              Backup of the encrypted vault.
            </span>{" "}
            Backing up the data directory is good — but the encrypted
            vault is the most sensitive thing in it. Store backups somewhere
            you trust, and protect them with the same care as the original.
          </li>
          <li>
            <span className="text-[var(--color-text)]">RPC trust.</span> The
            bot reads prices via the configured RPC. A malicious RPC could
            in principle return wrong prices to mis-trigger. Use an RPC you
            trust.
          </li>
        </ul>
      </section>
    </div>
  );
}
