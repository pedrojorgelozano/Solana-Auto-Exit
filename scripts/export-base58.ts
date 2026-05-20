import fs from "node:fs";
import { getBase58Codec } from "@solana/kit";

const path = process.argv[2] ?? "wallet.json";
const bytes = new Uint8Array(JSON.parse(fs.readFileSync(path, "utf8")));
const b58 = getBase58Codec().decode(bytes);
console.log(b58);
