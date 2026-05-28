/**
 * Seed de tasks ficticias para probar la pantalla `/tasks` (Histórico).
 *
 * Inserta 6 tasks en estados `done`, `stopped`, `error` con datos
 * plausibles (pares conocidos, timestamps variados, lastError con
 * mensajes reales del adapter). Todas marcadas con id-prefix `seed-`
 * para limpiarlas trivialmente.
 *
 * Uso:
 *   pnpm --filter @solana-auto-exit/server exec tsx scripts/seed-history.ts
 *   pnpm --filter @solana-auto-exit/server exec tsx scripts/seed-history.ts --clean
 *
 * Aviso: las tasks seed funcionan en la lista de Histórico. Si abres
 * el detalle de una seed (`/tasks/[id]`), `getPositionSummary` fallará
 * porque el positionId no existe on-chain. Es el coste aceptado — el
 * objetivo es probar la lista, no el detalle.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { like } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as schema from "../src/db/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH =
  process.env.DB_PATH ?? path.resolve(__dirname, "../data/auto-exit.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

const isClean = process.argv.includes("--clean");

if (isClean) {
  const result = db
    .delete(schema.tasks)
    .where(like(schema.tasks.id, "seed-%"))
    .run();
  console.log(`[seed] removed ${result.changes} seed tasks (history cascaded)`);
  sqlite.close();
  process.exit(0);
}

// ============================================================================
// Token mints conocidos por el registry (packages/web/src/lib/tokens.ts) —
// usar éstos garantiza que `tokenSymbol` y `formatTaskPair` renderizan
// nombres legibles en la UI.
// ============================================================================

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JITOSOL = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
const MSOL = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const DEVUSDC = "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k";

// Position IDs ficticios — base58 válido (no existe on-chain).
const FAKE_POSITIONS = [
  "8tcUDqfwLXgM77vKqg9xJj5KmH6BWBaKB8qE2Y9c5dLm",
  "5oR2NhEdgvJpKLm3sJxc8aRfvB4XdN7QkPzWbY1hFmZ9",
  "GZ4kPmW8vYxK3jXBdH7T5sUq9aWmRsPDcRnVbE2yCkLp",
  "DkH9tFqL3mY8vN7c2sR1jXKaBpW5zMnUgPbVfE6XhT4Q",
  "Fn5xKpW3mYqB8vH7t2sR4jXTaCpV6zMnUgPdVfE2YhJ9",
  "AmRTPjMxgK7nF4YwL9q2Vk1bWzS8XdHpCBn5YfE3VhU6",
];

const now = Date.now();
const days = (n: number) => n * 86_400_000;
const hours = (n: number) => n * 3_600_000;
const minutes = (n: number) => n * 60_000;

const seeds = [
  // 1. DONE — TP exitoso, SOL/USDC mainnet, hace 3 días
  {
    id: "seed-001",
    protocol: "orca",
    network: "mainnet" as const,
    rpcUrl: "https://api.mainnet-beta.solana.com",
    positionId: FAKE_POSITIONS[0],
    protocolConfig: {
      tokenMintA: SOL,
      tokenMintB: USDC,
      positionMint: FAKE_POSITIONS[0],
      decimalsA: 9,
      decimalsB: 6,
    },
    takeProfitPrice: 195.0,
    stopLossPrice: 150.0,
    takeProfitBufferMs: null,
    stopLossBufferMs: null,
    triggeredBy: "take_profit" as const,
    slippageBps: 50,
    pollMs: 30_000,
    dryRun: false,
    exitTokenMint: null,
    exitSwapSlippageBps: 50,
    status: "done" as const,
    createdAt: new Date(now - days(5)),
    updatedAt: new Date(now - days(3)),
    triggeredAt: new Date(now - days(3) - hours(1)),
    closeResult: {
      txId: "5xPGgLMx8YtVnRTpJKqBfWvDqHcN3jU7XbE2cMfPdRsT4kVnQpWxYhDfMeUbAhKn",
      withdrawnA: "12340000000",
      withdrawnB: "2407300000",
    },
    swapResult: null,
    lastError: null,
  },
  // 2. DONE — SL disparado, SOL/USDC mainnet, hace 1 día
  {
    id: "seed-002",
    protocol: "orca",
    network: "mainnet" as const,
    rpcUrl: "https://api.mainnet-beta.solana.com",
    positionId: FAKE_POSITIONS[1],
    protocolConfig: {
      tokenMintA: SOL,
      tokenMintB: USDC,
      positionMint: FAKE_POSITIONS[1],
      decimalsA: 9,
      decimalsB: 6,
    },
    takeProfitPrice: 220.0,
    stopLossPrice: 170.0,
    takeProfitBufferMs: hours(6),
    stopLossBufferMs: null,
    triggeredBy: "stop_loss" as const,
    slippageBps: 50,
    pollMs: 30_000,
    dryRun: false,
    exitTokenMint: null,
    exitSwapSlippageBps: 50,
    status: "done" as const,
    createdAt: new Date(now - days(4)),
    updatedAt: new Date(now - days(1)),
    triggeredAt: new Date(now - days(1) - minutes(30)),
    closeResult: {
      txId: "3mNcKvBxL5YpTfRqWdJjE2sUuP1aHgVnXkZ7Cb6yMxKqWvNpRtFhBuAcEoDjPmYr",
      withdrawnA: "8500000000",
      withdrawnB: "1455500000",
    },
    swapResult: null,
    lastError: null,
  },
  // 3. DONE — TP + swap to USDC, JitoSOL/SOL mainnet, hace 5h
  {
    id: "seed-003",
    protocol: "orca",
    network: "mainnet" as const,
    rpcUrl: "https://api.mainnet-beta.solana.com",
    positionId: FAKE_POSITIONS[2],
    protocolConfig: {
      tokenMintA: JITOSOL,
      tokenMintB: SOL,
      positionMint: FAKE_POSITIONS[2],
      decimalsA: 9,
      decimalsB: 9,
    },
    takeProfitPrice: 1.092,
    stopLossPrice: null,
    takeProfitBufferMs: hours(12),
    stopLossBufferMs: null,
    triggeredBy: "take_profit" as const,
    slippageBps: 30,
    pollMs: 60_000,
    dryRun: false,
    exitTokenMint: USDC,
    exitSwapSlippageBps: 50,
    status: "done" as const,
    createdAt: new Date(now - days(3)),
    updatedAt: new Date(now - hours(5)),
    triggeredAt: new Date(now - hours(5) - minutes(10)),
    closeResult: {
      txId: "8jHxKvBpL5YqTfRsWdMjE2sUbP1aHgVnXkZ7Cb6yMxKqWvNpRtFhBuAcEoDjPmYz",
      withdrawnA: "15000000000",
      withdrawnB: "16500000000",
    },
    swapResult: {
      txId: "9mNcKvBxL5YpTfRqWdJjE2sUuP1aHgVnXkZ7Cb6yMxKqWvNpRtFhBuAcEoDjPmYr",
      inMint: JITOSOL,
      outMint: USDC,
      inAmount: "15000000000",
      outAmount: "6450500000",
    },
    lastError: null,
  },
  // 4. STOPPED — detenida por usuario, mSOL/SOL, hace 8h
  {
    id: "seed-004",
    protocol: "meteora",
    network: "mainnet" as const,
    rpcUrl: "https://api.mainnet-beta.solana.com",
    positionId: FAKE_POSITIONS[3],
    protocolConfig: {
      tokenMintA: MSOL,
      tokenMintB: SOL,
      lbPair: FAKE_POSITIONS[3],
      decimalsA: 9,
      decimalsB: 9,
    },
    takeProfitPrice: 1.18,
    stopLossPrice: 1.12,
    takeProfitBufferMs: null,
    stopLossBufferMs: hours(2),
    triggeredBy: null,
    slippageBps: 75,
    pollMs: 30_000,
    dryRun: false,
    exitTokenMint: null,
    exitSwapSlippageBps: 50,
    status: "stopped" as const,
    createdAt: new Date(now - days(2)),
    updatedAt: new Date(now - hours(8)),
    triggeredAt: null,
    closeResult: null,
    swapResult: null,
    lastError: null,
  },
  // 5. ERROR — slippage exceeded, BONK/SOL, hace 2h
  {
    id: "seed-005",
    protocol: "orca",
    network: "mainnet" as const,
    rpcUrl: "https://api.mainnet-beta.solana.com",
    positionId: FAKE_POSITIONS[4],
    protocolConfig: {
      tokenMintA: BONK,
      tokenMintB: SOL,
      positionMint: FAKE_POSITIONS[4],
      decimalsA: 5,
      decimalsB: 9,
    },
    takeProfitPrice: 0.00003,
    stopLossPrice: 0.0000185,
    takeProfitBufferMs: null,
    stopLossBufferMs: null,
    triggeredBy: "take_profit" as const,
    slippageBps: 100,
    pollMs: 15_000,
    dryRun: false,
    exitTokenMint: null,
    exitSwapSlippageBps: 100,
    status: "error" as const,
    createdAt: new Date(now - days(1)),
    updatedAt: new Date(now - hours(2)),
    triggeredAt: new Date(now - hours(2) - minutes(5)),
    closeResult: null,
    swapResult: null,
    lastError:
      "Slippage exceeded: expected 1500000 BONK, got 1380000 (max slippage 1%).",
  },
  // 6. DONE — devnet, SOL/devUSDC, hace 1h (modo dry-run)
  {
    id: "seed-006",
    protocol: "orca",
    network: "devnet" as const,
    rpcUrl: "https://api.devnet.solana.com",
    positionId: FAKE_POSITIONS[5],
    protocolConfig: {
      tokenMintA: SOL,
      tokenMintB: DEVUSDC,
      positionMint: FAKE_POSITIONS[5],
      decimalsA: 9,
      decimalsB: 6,
    },
    takeProfitPrice: 23.5,
    stopLossPrice: 11.2,
    takeProfitBufferMs: hours(6),
    stopLossBufferMs: null,
    triggeredBy: "take_profit" as const,
    slippageBps: 50,
    pollMs: 30_000,
    dryRun: true,
    exitTokenMint: null,
    exitSwapSlippageBps: 50,
    status: "done" as const,
    createdAt: new Date(now - hours(3)),
    updatedAt: new Date(now - hours(1)),
    triggeredAt: new Date(now - hours(1) - minutes(15)),
    closeResult: {
      txId: "DryRunSimulationDoesNotProduceARealTxId000000000000000000000",
      withdrawnA: "500000000",
      withdrawnB: "11769000",
    },
    swapResult: null,
    lastError: null,
  },
];

const insertedTasks = db.insert(schema.tasks).values(seeds).run();
console.log(`[seed] inserted ${insertedTasks.changes} tasks into history`);

// Algunos history events para que el detalle de las completed tenga timeline.
const historyEvents = [
  {
    id: "seed-hist-001-1",
    taskId: "seed-001",
    timestamp: new Date(now - days(5)),
    event: "created",
    data: { protocol: "orca", posShort: "8tcU…5dLm" },
  },
  {
    id: "seed-hist-001-2",
    taskId: "seed-001",
    timestamp: new Date(now - days(5) + minutes(2)),
    event: "started",
    data: {},
  },
  {
    id: "seed-hist-001-3",
    taskId: "seed-001",
    timestamp: new Date(now - days(3) - hours(1) - minutes(5)),
    event: "triggered",
    data: { kind: "take_profit", price: 195.42 },
  },
  {
    id: "seed-hist-001-4",
    taskId: "seed-001",
    timestamp: new Date(now - days(3) - hours(1)),
    event: "closed",
    data: {
      txId: "5xPGgLMx8YtVnRTpJKqBfWvDqHcN3jU7XbE2cMfPdRsT4kVnQpWxYhDfMeUbAhKn",
    },
  },
];

const insertedHistory = db.insert(schema.history).values(historyEvents).run();
console.log(`[seed] inserted ${insertedHistory.changes} history events`);
console.log(`[seed] done. Reload /tasks to see them.`);
console.log(
  `[seed] cleanup: pnpm --filter @solana-auto-exit/server exec tsx scripts/seed-history.ts --clean`,
);

sqlite.close();
