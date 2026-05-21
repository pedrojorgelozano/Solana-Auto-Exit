import { ArticleHeader } from "../_components/ArticleHeader";
import { articleBySlug } from "../_components/articles";

const article = articleBySlug("/docs/disclaimer")!;

export default function Disclaimer() {
  return (
    <div className="space-y-10">
      <ArticleHeader article={article} />

      <section className="border-l-2 border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-5 py-4">
        <p className="t-body text-[var(--color-text)]">
          <strong>
            This software is provided &ldquo;as is&rdquo;, without warranty of
            any kind. You install, configure and use it entirely at your own
            risk.
          </strong>{" "}
          By downloading, installing or running it, you accept full
          responsibility for any consequences — including the partial or
          total loss of the funds it manages.
        </p>
      </section>

      <section>
        <h2 className="t-h2">No warranty, no guarantee</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The author of this tool makes no representations or warranties of
          any kind, express or implied, about the completeness, accuracy,
          reliability, suitability or availability of the software, its
          features or the underlying code. Bugs may exist, prices may move
          unexpectedly, RPC endpoints may misbehave, on-chain protocols may
          change, and your transactions may fail or settle at a worse price
          than quoted. None of these risks are removed by using the tool —
          some are made more visible.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Not financial advice</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Nothing in this software, its documentation or any associated
          channel constitutes financial, investment, legal, tax or
          accounting advice. Take-profit and stop-loss thresholds, slippage
          tolerances, time buffers, RPC endpoints, network defaults — every
          parameter the tool exposes — are yours to choose. The author is
          not a financial advisor and has no fiduciary relationship with you.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          Decentralized finance involves substantial risk. Past behavior of a
          pool, token, protocol or strategy is not indicative of future
          results. You may lose part or all of the capital you commit to
          positions watched by this tool. Do not commit funds you cannot
          afford to lose.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Your responsibilities</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          When you choose to install and run this tool, you are responsible
          for:
        </p>
        <ul className="mt-4 space-y-3 t-body text-[var(--color-text-muted)]">
          <li>
            <strong className="text-[var(--color-text)]">
              The security of the machine
            </strong>{" "}
            where it runs — that nobody untrusted can read the filesystem,
            inspect process memory while the vault is unlocked, or otherwise
            extract the encrypted key.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              The strength of your passphrase
            </strong>{" "}
            — long, random, stored in a password manager. A weak passphrase
            shortens the time an attacker needs to brute-force the encrypted
            vault.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              The RPC endpoint you point it at
            </strong>{" "}
            — a malicious RPC could return wrong prices and trigger closes
            you didn&apos;t intend. Use providers you trust (or a node you
            run).
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              The parameters you configure
            </strong>{" "}
            — take-profit, stop-loss, slippage tolerance, time buffer, exit
            token. The tool executes what you tell it to. It does not
            second-guess your numbers.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              The funds you put in the bot wallet
            </strong>{" "}
            — treat the bot wallet as an operational hot account, separate
            from cold holdings. Only fund it with what you&apos;re willing to
            have at risk while the watcher is armed.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              Compliance with applicable laws
            </strong>{" "}
            — tax reporting, anti-money-laundering rules, securities
            regulations, sanctions and any other obligations that apply in
            your jurisdiction. The tool does not handle, advise on or
            disclose any of this.
          </li>
        </ul>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">Limitation of liability</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          To the maximum extent permitted by applicable law, the author shall
          not be liable for any direct, indirect, incidental, consequential,
          special, exemplary or punitive damages — including but not limited
          to loss of funds, loss of data, loss of profits, business
          interruption or any other losses — arising out of or related to
          the use of, or inability to use, this software, even if advised of
          the possibility of such damages.
        </p>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          If you do not agree to this disclaimer, do not install or use this
          software.
        </p>
      </section>

      <section className="hairline-t pt-10">
        <h2 className="t-h2">License</h2>
        <p className="mt-3 t-body text-[var(--color-text-muted)]">
          The source code is distributed under the MIT License. See{" "}
          <code className="t-num text-[var(--color-text)]">LICENSE</code> in
          the repository root for the full text. The MIT License itself
          includes the same &ldquo;THE SOFTWARE IS PROVIDED AS IS&rdquo;
          clause that this page expands on in plain English.
        </p>
      </section>
    </div>
  );
}
