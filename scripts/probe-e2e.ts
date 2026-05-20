/**
 * Probe end-to-end del server: vault → unlock → list positions → create task
 * → start → wait for done. Spawns el server con un vault aislado (no toca
 * el de producción) y lo limpia al terminar.
 *
 * Uso:
 *   pnpm tsx scripts/probe-e2e.ts            # dry-run (no envía tx; default)
 *   pnpm tsx scripts/probe-e2e.ts --real     # real (cierra la posición de verdad)
 *
 * Pre-requisito: wallet.json en la raíz con SOL en devnet, y una posición
 * Whirlpool abierta en esa wallet (Orca devnet UI, custom range, 0.1 SOL).
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const SERVER_URL = "http://127.0.0.1:7777";
const PROBE_VAULT = path.resolve("packages/server/data/probe-vault.json");
const SOURCE_WALLET = "wallet.json";
const RPC_URL = "https://api.devnet.solana.com";
const NETWORK = "devnet";
const PASSPHRASE = "probe-passphrase-1234";

const DRY_RUN = !process.argv.includes("--real");

// ============================================================================
// tRPC client (non-batched HTTP)
// ============================================================================

async function trpcQuery<T>(name: string, input?: unknown): Promise<T> {
  const url =
    input === undefined
      ? `${SERVER_URL}/trpc/${name}`
      : `${SERVER_URL}/trpc/${name}?input=${encodeURIComponent(JSON.stringify(input))}`;
  const res = await fetch(url);
  const json = (await res.json()) as
    | { result: { data: T } }
    | { error: { message: string; data?: unknown } };
  if ("error" in json) {
    throw new Error(`tRPC ${name}: ${json.error.message}`);
  }
  return json.result.data;
}

async function trpcMutate<T>(name: string, input?: unknown): Promise<T> {
  const res = await fetch(`${SERVER_URL}/trpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  const json = (await res.json()) as
    | { result: { data: T } }
    | { error: { message: string; data?: unknown } };
  if ("error" in json) {
    throw new Error(`tRPC ${name}: ${json.error.message}`);
  }
  return json.result.data;
}

// ============================================================================
// Server lifecycle
// ============================================================================

let server: ChildProcess | null = null;

async function startServer(): Promise<void> {
  if (fs.existsSync(PROBE_VAULT)) fs.unlinkSync(PROBE_VAULT);

  log("Starting server with probe vault...");
  server = spawn("pnpm", ["start:server"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: {
      ...process.env,
      WALLET_VAULT_PATH: PROBE_VAULT,
    },
  });
  server.stdout?.on("data", (d) => process.stdout.write(`[server] ${d}`));
  server.stderr?.on("data", (d) => process.stderr.write(`[server] ${d}`));

  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${SERVER_URL}/trpc/health`);
      if (r.ok) {
        log("Server is up.");
        return;
      }
    } catch {
      /* not ready yet */
    }
    await sleep(500);
  }
  throw new Error("Server didn't respond within 20s.");
}

async function stopServer(): Promise<void> {
  if (!server || server.pid === undefined) return;
  log("Stopping server...");
  // En Windows, pnpm.cmd → tsx son padre/nieto. server.kill() solo mata al
  // padre y el nieto queda huérfano ocupando el puerto. taskkill /T mata
  // el árbol entero.
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /T /PID ${server.pid}`, { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
  } catch {
    /* puede que ya estuviera muerto */
  }
  await new Promise<void>((resolve) => {
    if (!server) return resolve();
    server.on("exit", () => resolve());
    setTimeout(resolve, 3000);
  });
  server = null;
  if (fs.existsSync(PROBE_VAULT)) fs.unlinkSync(PROBE_VAULT);
}

function log(msg: string): void {
  console.log(`\n=== ${msg} ===`);
}

// ============================================================================
// E2E flow
// ============================================================================

async function run(): Promise<void> {
  log(`probe-e2e: dryRun=${DRY_RUN} network=${NETWORK}`);

  // -- 1. Health
  const health = await trpcQuery<{ ok: boolean; version: string }>("health");
  if (!health.ok) throw new Error("Health check failed");
  log(`Server v${health.version}`);

  // -- 2. Wallet vault: create → unlock
  const initialStatus = await trpcQuery<{
    hasVault: boolean;
    unlocked: boolean;
    address: string | null;
  }>("wallet.status");
  if (initialStatus.hasVault) {
    throw new Error(
      `Probe vault already exists at ${PROBE_VAULT}, expected clean state.`,
    );
  }

  log("Creating vault from wallet.json...");
  const walletJsonContents = fs.readFileSync(SOURCE_WALLET, "utf8");
  const created = await trpcMutate<{ address: string }>("wallet.create", {
    passphrase: PASSPHRASE,
    source: { type: "jsonArray", value: walletJsonContents },
  });
  log(`Vault created. address=${created.address}`);

  log("Unlocking vault...");
  await trpcMutate<{ address: string }>("wallet.unlock", {
    passphrase: PASSPHRASE,
  });
  const status2 = await trpcQuery<{ unlocked: boolean }>("wallet.status");
  if (!status2.unlocked) throw new Error("Vault did not unlock.");
  log("Vault unlocked.");

  // -- 3. Discover positions
  log("Listing owned positions...");
  const refs = await trpcQuery<
    Array<{ protocol: string; id: string; label: string; poolId: string }>
  >("positions.listOwned", {
    protocol: "orca",
    network: NETWORK,
    rpcUrl: RPC_URL,
    owner: created.address,
  });
  log(`Found ${refs.length} position(s).`);
  for (const r of refs) console.log(`  - ${r.label}  mint=${r.id}`);

  if (refs.length === 0) {
    log(
      "No positions open. Open one in Orca devnet UI (custom range 25-30, 0.1 SOL) and re-run.",
    );
    return;
  }

  const ref = refs[0]!;

  // -- 4. Position summary
  log("Fetching position summary...");
  const summary = await trpcQuery<{
    currentPrice: number;
    range: { min: number; max: number };
    isInRange: boolean;
    tokenA: { mint: string; decimals: number };
    tokenB: { mint: string; decimals: number };
  }>("positions.getSummary", {
    protocol: "orca",
    network: NETWORK,
    rpcUrl: RPC_URL,
    ref,
  });
  console.log(
    `  price=${summary.currentPrice} range=[${summary.range.min}, ${summary.range.max}] inRange=${summary.isInRange}`,
  );
  console.log(
    `  tokenA decimals=${summary.tokenA.decimals} tokenB decimals=${summary.tokenB.decimals}`,
  );

  // -- 5. Create task that triggers immediately
  log("Creating task with immediate trigger...");
  const target = summary.currentPrice - 0.01; // direction=above, target just below
  const newTask = await trpcMutate<{ id: string }>("tasks.create", {
    protocol: "orca",
    network: NETWORK,
    rpcUrl: RPC_URL,
    positionId: ref.id,
    protocolConfig: {
      positionMint: ref.id,
      decimalsA: summary.tokenA.decimals,
      decimalsB: summary.tokenB.decimals,
    },
    targetPrice: target,
    direction: "above",
    slippageBps: 100,
    pollMs: 5000,
    dryRun: DRY_RUN,
    exitSwapSlippageBps: 100,
  });
  log(`Task created: id=${newTask.id} (target=${target}, direction=above)`);

  // -- 6. Start it
  log("Starting task...");
  await trpcMutate("tasks.start", { id: newTask.id });

  // -- 7. Poll until terminal
  log("Polling task status (max 60s)...");
  let lastStatus = "";
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const t = await trpcQuery<{
      status: string;
      lastError: string | null;
      closeResult: Record<string, unknown> | null;
      swapResult: Record<string, unknown> | null;
      runtime: { isRunning: boolean; lastPrice: number | null };
    }>("tasks.get", { id: newTask.id });

    if (t.status !== lastStatus) {
      console.log(
        `  status=${t.status} runtime=${JSON.stringify(t.runtime)} ${t.lastError ? `err="${t.lastError}"` : ""}`,
      );
      lastStatus = t.status;
    }

    if (t.status === "done") {
      log("Task finished successfully.");
      console.log("  closeResult:", JSON.stringify(t.closeResult, null, 2));
      if (t.swapResult)
        console.log("  swapResult:", JSON.stringify(t.swapResult, null, 2));
      break;
    }
    if (t.status === "error") {
      throw new Error(`Task errored: ${t.lastError ?? "unknown"}`);
    }
    await sleep(1500);
  }

  // -- 8. Cleanup task row
  log("Deleting task...");
  await trpcMutate("tasks.delete", { id: newTask.id });
  log("E2E completed.");
}

// ============================================================================
// Entry
// ============================================================================

async function main(): Promise<void> {
  try {
    await startServer();
    await run();
  } finally {
    await stopServer();
  }
}

main().catch((err) => {
  console.error("\nPROBE FAILED:", err);
  void stopServer().finally(() => process.exit(1));
});
