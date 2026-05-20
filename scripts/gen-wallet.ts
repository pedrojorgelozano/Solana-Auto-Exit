import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import { createKeyPairSignerFromBytes } from "@solana/kit";

const outPath = process.argv[2] ?? "wallet.json";
if (fs.existsSync(outPath)) {
  console.error(`Ya existe ${outPath}. No sobrescribo (borra el archivo si quieres regenerar).`);
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");

const privDer = privateKey.export({ format: "der", type: "pkcs8" });
const seed = privDer.subarray(privDer.length - 32);

const pubDer = publicKey.export({ format: "der", type: "spki" });
const pubRaw = pubDer.subarray(pubDer.length - 32);

const secretKey = Buffer.concat([seed, pubRaw]);

fs.writeFileSync(outPath, JSON.stringify(Array.from(secretKey)));

const signer = await createKeyPairSignerFromBytes(new Uint8Array(secretKey));
console.log(`Wallet creada: ${outPath}`);
console.log(`Address:       ${signer.address}`);
console.log(`\nSiguientes pasos manuales:`);
console.log(`  1) Airdrop devnet SOL:`);
console.log(`     - Faucet web: https://faucet.solana.com  (selecciona "devnet")`);
console.log(`     - O CLI:      solana airdrop 2 ${signer.address} --url https://api.devnet.solana.com`);
console.log(`  2) Comprueba el balance en https://solscan.io/account/${signer.address}?cluster=devnet`);
