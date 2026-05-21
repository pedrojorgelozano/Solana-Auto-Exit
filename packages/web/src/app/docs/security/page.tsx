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
