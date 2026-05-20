import fs from "node:fs";
import { createKeyPairSignerFromBytes } from "@solana/kit";

import { loadBaseConfig } from "./config/env.js";
import { runRunner } from "./core/runner.js";
import { log, logError } from "./core/logger.js";
import { makeAdapter } from "./protocols/registry.js";

async function main(): Promise<void> {
  const base = loadBaseConfig();
  log(
    `Arrancando solana-auto-exit | protocol=${base.protocol} network=${base.network} dryRun=${base.dryRun}`,
  );

  const adapter = makeAdapter(base.protocol);
  const protocolConfig = adapter.loadProtocolConfig(process.env);

  const secret = JSON.parse(fs.readFileSync(base.walletPath, "utf8")) as number[];
  const wallet = await createKeyPairSignerFromBytes(new Uint8Array(secret));
  log(`Wallet cargada: ${wallet.address}`);

  await runRunner({ adapter, base, protocolConfig, wallet });
}

main().catch((err) => {
  logError("Fallo fatal", err);
  process.exit(1);
});
