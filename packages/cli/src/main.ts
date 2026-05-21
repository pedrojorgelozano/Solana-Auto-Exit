import fs from "node:fs";
import { createKeyPairSignerFromBytes } from "@solana/kit";

import {
  loadBaseConfig,
  makeAdapter,
  runRunner,
  log,
  logError,
} from "@solana-auto-exit/engine";

async function main(): Promise<void> {
  const base = loadBaseConfig();
  log(
    `Arrancando solana-auto-exit | protocol=${base.protocol} network=${base.network} dryRun=${base.dryRun}`,
  );

  const adapter = makeAdapter(base.protocol);
  const protocolConfig = adapter.loadProtocolConfig(process.env);

  const secret = JSON.parse(fs.readFileSync(base.walletPath, "utf8")) as number[];
  const rawSecret = new Uint8Array(secret);
  const wallet = await createKeyPairSignerFromBytes(rawSecret);
  log(`Wallet cargada: ${wallet.address}`);

  await runRunner({ adapter, base, protocolConfig, wallet, rawSecret });
}

main().catch((err) => {
  logError("Fallo fatal", err);
  process.exit(1);
});
