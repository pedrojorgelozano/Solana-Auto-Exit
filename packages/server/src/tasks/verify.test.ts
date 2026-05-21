import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyTxBalances, VerificationError } from "./verify.js";

const OWNER = "OwnerAddr11111111111111111111111111111111111";

function rpcResponse(result: unknown): Response {
  return new Response(JSON.stringify({ result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("verifyTxBalances — happy path parsing", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("computes solDelta from pre/postBalances of the owner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        rpcResponse({
          transaction: { message: { accountKeys: [OWNER, "Other"] } },
          meta: {
            err: null,
            fee: 5000,
            preBalances: [1_000_000_000, 500],
            postBalances: [999_500_000, 500],
            preTokenBalances: [],
            postTokenBalances: [],
          },
        }),
      ),
    );
    const r = await verifyTxBalances("http://ok", "sig", OWNER);
    expect(r.fee).toBe(5000n);
    expect(r.solDelta).toBe(-500_000n);
    expect(Object.keys(r.tokenDeltas)).toHaveLength(0);
  });

  it("aggregates token deltas only for owned accounts", async () => {
    const MINT_A = "MintAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    const MINT_B = "MintBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        rpcResponse({
          transaction: { message: { accountKeys: [OWNER, "Other", "OtherATA"] } },
          meta: {
            err: null,
            fee: 5000,
            preBalances: [0, 0, 0],
            postBalances: [0, 0, 0],
            preTokenBalances: [
              {
                accountIndex: 0,
                mint: MINT_A,
                owner: OWNER,
                uiTokenAmount: { amount: "1000000", decimals: 6 },
              },
              {
                accountIndex: 2,
                mint: MINT_B,
                owner: "Foreigner",
                uiTokenAmount: { amount: "999999", decimals: 6 },
              },
            ],
            postTokenBalances: [
              {
                accountIndex: 0,
                mint: MINT_A,
                owner: OWNER,
                uiTokenAmount: { amount: "2000000", decimals: 6 },
              },
              {
                accountIndex: 2,
                mint: MINT_B,
                owner: "Foreigner",
                uiTokenAmount: { amount: "0", decimals: 6 },
              },
            ],
          },
        }),
      ),
    );
    const r = await verifyTxBalances("http://ok", "sig", OWNER);
    // Solo aparece MINT_A: el delta de MINT_B se ignora porque su owner es otro.
    expect(r.tokenDeltas[MINT_A]).toBe(1_000_000n);
    expect(r.tokenDeltas[MINT_B]).toBeUndefined();
  });

  it("excludes mints whose delta is zero", async () => {
    const MINT_A = "MintAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        rpcResponse({
          transaction: { message: { accountKeys: [OWNER] } },
          meta: {
            err: null,
            fee: 5000,
            preBalances: [1_000_000_000],
            postBalances: [1_000_000_000], // mismo balance
            preTokenBalances: [
              {
                accountIndex: 0,
                mint: MINT_A,
                owner: OWNER,
                uiTokenAmount: { amount: "100", decimals: 6 },
              },
            ],
            postTokenBalances: [
              {
                accountIndex: 0,
                mint: MINT_A,
                owner: OWNER,
                uiTokenAmount: { amount: "100", decimals: 6 },
              },
            ],
          },
        }),
      ),
    );
    const r = await verifyTxBalances("http://ok", "sig", OWNER);
    expect(r.solDelta).toBe(0n);
    expect(r.tokenDeltas).toEqual({});
  });
});

describe("verifyTxBalances — error paths", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Fake timers para acelerar el backoff lineal (500/1000/1500/2000/2500ms).
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1 });
  });
  afterEach(() => vi.useRealTimers());

  it("throws VerificationError when meta is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        rpcResponse({
          transaction: { message: { accountKeys: [OWNER] } },
          meta: null,
        }),
      ),
    );
    await expect(verifyTxBalances("http://ok", "sig", OWNER)).rejects.toThrow(
      VerificationError,
    );
  });

  it("throws VerificationError when the tx failed on-chain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        rpcResponse({
          transaction: { message: { accountKeys: [OWNER] } },
          meta: {
            err: { InstructionError: [0, "SlippageExceeded"] },
            fee: 5000,
            preBalances: [0],
            postBalances: [0],
          },
        }),
      ),
    );
    await expect(verifyTxBalances("http://ok", "sig", OWNER)).rejects.toThrow(
      /SlippageExceeded/,
    );
  });

  it("retries when result is null (tx not yet indexed) then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rpcResponse(null)) // 1st: indexer aún no la tiene
      .mockResolvedValueOnce(
        rpcResponse({
          transaction: { message: { accountKeys: [OWNER] } },
          meta: {
            err: null,
            fee: 5000,
            preBalances: [1_000_000_000],
            postBalances: [999_995_000],
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const p = verifyTxBalances("http://ok", "sig", OWNER);
    await vi.advanceTimersByTimeAsync(600); // 1 retry = 500ms sleep
    const r = await p;
    expect(r.solDelta).toBe(-5_000n);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("eventually gives up if the RPC never indexes the tx", async () => {
    // mockImplementation (no mockResolvedValue): cada call genera una Response
    // FRESCA. Una Response solo se puede consumir una vez; reusar la misma
    // tira "Body is unusable" en el segundo retry. Bug de mock encontrado.
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => rpcResponse(null)));
    const p = verifyTxBalances("http://ok", "sig", OWNER);
    // Necesitamos handler para evitar unhandled rejection en el bus de tests;
    // capturamos y validamos manualmente.
    const errPromise = p.catch((e) => e);
    await vi.advanceTimersByTimeAsync(8000);
    const err = await errPromise;
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toMatch(/Could not fetch tx receipt/);
  });

  it("passes an AbortSignal to fetch on every attempt (B-03 shape check)", async () => {
    let observedSignals = 0;
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      if (init?.signal instanceof AbortSignal) observedSignals++;
      return Promise.resolve(rpcResponse(null));
    });
    const p = verifyTxBalances("http://ok", "sig", OWNER);
    const errPromise = p.catch((e) => e);
    await vi.advanceTimersByTimeAsync(8000);
    const err = await errPromise;
    expect(err).toBeInstanceOf(Error);
    expect(observedSignals).toBe(5);
  });
});
