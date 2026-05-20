/**
 * Smoke test del WalletVault: roundtrip, passphrase mala, lock/unlock, delete.
 */
import fs from "node:fs";
import path from "node:path";
import { WalletVault } from "../packages/server/src/wallet/vault.js";
import { bytesFromJsonArray } from "../packages/server/src/wallet/import.js";

const SOURCE_WALLET = process.argv[2] ?? "wallet.json";
const VAULT_PATH = process.argv[3] ?? "./packages/server/data/test-vault.json";
const PASSPHRASE = "correct horse battery staple";
const WRONG_PASSPHRASE = "wrong horse battery staple";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

async function main(): Promise<void> {
  // Sanitize: borra vault previa si quedó de un run anterior.
  if (fs.existsSync(VAULT_PATH)) fs.unlinkSync(VAULT_PATH);

  const secret = bytesFromJsonArray(fs.readFileSync(SOURCE_WALLET, "utf8"));
  console.log(`Loaded ${secret.length}-byte secret from ${SOURCE_WALLET}`);

  const vault = new WalletVault(path.resolve(VAULT_PATH));
  expect(!vault.exists(), "vault should not exist initially");

  // --- create ---
  console.log("Creating vault...");
  const created = await vault.create(PASSPHRASE, secret);
  expect(vault.exists(), "vault file should exist after create");
  console.log(`  address: ${created.address}`);

  // --- status (locked, but address visible) ---
  let s = vault.status();
  expect(s.hasVault === true && s.unlocked === false, "status: hasVault=true, unlocked=false");
  expect(s.address === created.address, "status.address should match created.address");

  // --- wrong passphrase ---
  console.log("Trying wrong passphrase (should fail)...");
  try {
    await vault.unlock(WRONG_PASSPHRASE);
    fail("unlock with wrong passphrase should have thrown");
  } catch (err) {
    console.log(`  got expected error: ${(err as Error).message}`);
  }
  expect(!vault.isUnlocked(), "wrong passphrase should not unlock");

  // --- correct passphrase ---
  console.log("Unlocking with correct passphrase...");
  const unlocked = await vault.unlock(PASSPHRASE);
  expect(unlocked.address === created.address, "unlocked address must match");
  expect(vault.isUnlocked(), "vault should be unlocked");
  const kp = vault.getKeypair();
  expect(String(kp.address) === created.address, "getKeypair().address must match");

  // --- lock ---
  console.log("Locking...");
  vault.lock();
  expect(!vault.isUnlocked(), "vault should be locked");
  try {
    vault.getKeypair();
    fail("getKeypair() after lock should have thrown");
  } catch (err) {
    console.log(`  got expected error: ${(err as Error).message}`);
  }

  // --- re-unlock after lock ---
  console.log("Re-unlocking...");
  await vault.unlock(PASSPHRASE);
  expect(vault.isUnlocked(), "should be unlocked again");

  // --- delete ---
  console.log("Deleting...");
  vault.delete();
  expect(!vault.exists(), "vault file should be gone");
  expect(!vault.isUnlocked(), "memory should be cleared after delete");

  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
