/**
 * Verificación on-chain post-tx. Tras una close o swap reales (con tx
 * confirmada), llamamos getTransaction al RPC, parseamos pre/postBalances
 * + pre/postTokenBalances y devolvemos los deltas netos de la bot wallet.
 *
 * Se ejecuta de forma best-effort: si el RPC tarda en indexar la tx o
 * falla, el watcher continúa — la verificación es informativa, no crítica.
 */

export interface TxBalanceDeltas {
  /** Tx fee en lamports (siempre positivo). */
  fee: bigint;
  /**
   * Cambio neto de SOL nativo de la bot wallet. post - pre.
   * NOTA: cuando la wallet es payer (siempre en nuestro caso), este valor
   * ya incluye el descuento del fee. Si te interesa "lo que entró/salió
   * sin contar fees", suma `fee` cuando solDelta sea negativo y la wallet
   * es payer.
   */
  solDelta: bigint;
  /** Deltas de balance por mint (post - pre). Solo se incluyen mints con delta ≠ 0. */
  tokenDeltas: Record<string, bigint>;
}

export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationError";
  }
}

interface RawTokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}

interface RawTxMeta {
  err: unknown;
  fee: number;
  preBalances: number[];
  postBalances: number[];
  preTokenBalances?: RawTokenBalance[];
  postTokenBalances?: RawTokenBalance[];
}

interface RawTransaction {
  transaction: {
    message: {
      accountKeys: Array<string | { pubkey: string }>;
    };
  };
  meta: RawTxMeta | null;
}

/**
 * Timeout por request individual. Sin esto un RPC colgado bloquea el watcher
 * indefinidamente; con 15s + backoff lineal el peor caso son ~95s antes de
 * dar el receipt por perdido y marcar la verificación como fallida.
 */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Trae el receipt de la tx vía RPC. Reintenta hasta `maxAttempts` con
 * backoff lineal por si el indexer aún no la tiene tras la confirmación.
 */
async function fetchTransaction(
  rpcUrl: string,
  signature: string,
  maxAttempts = 5,
): Promise<RawTransaction> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [
            signature,
            { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
          ],
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        lastErr = new Error(`RPC HTTP ${res.status}`);
      } else {
        const body = (await res.json()) as {
          result?: RawTransaction | null;
          error?: { message?: string };
        };
        if (body.error) {
          lastErr = new Error(body.error.message ?? "RPC error");
        } else if (body.result) {
          return body.result;
        } else {
          lastErr = new Error("Tx not yet indexed");
        }
      }
    } catch (err) {
      lastErr = err;
    }
    // backoff lineal: 500ms, 1s, 1.5s, 2s, 2.5s
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  throw new VerificationError(
    `Could not fetch tx receipt for ${signature}: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

function keyAt(tx: RawTransaction, index: number): string | null {
  const k = tx.transaction.message.accountKeys[index];
  if (!k) return null;
  return typeof k === "string" ? k : k.pubkey;
}

/**
 * Computa los deltas netos de la bot wallet a partir de una tx confirmada.
 * Tira `VerificationError` si la tx falló on-chain o el RPC no la devuelve.
 */
export async function verifyTxBalances(
  rpcUrl: string,
  signature: string,
  owner: string,
): Promise<TxBalanceDeltas> {
  const tx = await fetchTransaction(rpcUrl, signature);
  if (!tx.meta) {
    throw new VerificationError(
      `Tx ${signature} has no meta (failed or pruned).`,
    );
  }
  if (tx.meta.err) {
    throw new VerificationError(
      `Tx ${signature} failed on-chain: ${JSON.stringify(tx.meta.err)}`,
    );
  }

  const { fee, preBalances, postBalances, preTokenBalances, postTokenBalances } =
    tx.meta;

  // SOL delta: encontrar el índice del owner en accountKeys
  let solDelta = 0n;
  for (let i = 0; i < preBalances.length; i++) {
    if (keyAt(tx, i) === owner) {
      solDelta = BigInt(postBalances[i] ?? 0) - BigInt(preBalances[i] ?? 0);
      break;
    }
  }

  // Token deltas: agregamos por mint, solo de cuentas con owner = bot wallet
  const pre = new Map<string, bigint>();
  const post = new Map<string, bigint>();
  for (const tb of preTokenBalances ?? []) {
    if (tb.owner === owner) {
      pre.set(
        tb.mint,
        (pre.get(tb.mint) ?? 0n) + BigInt(tb.uiTokenAmount.amount),
      );
    }
  }
  for (const tb of postTokenBalances ?? []) {
    if (tb.owner === owner) {
      post.set(
        tb.mint,
        (post.get(tb.mint) ?? 0n) + BigInt(tb.uiTokenAmount.amount),
      );
    }
  }
  const tokenDeltas: Record<string, bigint> = {};
  const allMints = new Set([...pre.keys(), ...post.keys()]);
  for (const mint of allMints) {
    const delta = (post.get(mint) ?? 0n) - (pre.get(mint) ?? 0n);
    if (delta !== 0n) {
      tokenDeltas[mint] = delta;
    }
  }

  return {
    fee: BigInt(fee),
    solDelta,
    tokenDeltas,
  };
}
