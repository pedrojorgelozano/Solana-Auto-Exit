/**
 * Compila el server Node como un binario único usando `bun build --compile`.
 * El binario incluye el runtime + nuestro código + node_modules. Tauri lo
 * bundlea como "sidecar" y lo spawn al arrancar la app desktop.
 *
 * Naming convention de Tauri sidecars:
 *   <name>-<target-triple>[.exe]
 *
 * Tauri busca el binario que matchea el host actual en bundle time, y al
 * cargarlo en runtime usa el path resuelto por `tauri::path::resource_dir()`.
 *
 * Requisitos:
 *   - Bun instalado en PATH. Instala con:
 *       Windows: powershell -c "irm bun.sh/install.ps1 | iex"
 *       Mac/Linux: curl -fsSL https://bun.sh/install | bash
 *   - El target triple del host coincide con el del usuario final
 *     (cross-compile entre OSes con bun --compile es posible pero
 *     deja módulos nativos sin compilar correctamente; mejor compilar
 *     en el OS de destino).
 *
 * Uso:
 *   pnpm --filter @solana-auto-exit/server build:binary
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Host platform → target triple Rust style (lo que Tauri espera) + bun
// target string.
interface PlatformSpec {
  triple: string;
  bunTarget: string;
  ext: string;
}

const PLATFORMS: Record<string, PlatformSpec> = {
  "win32-x64": {
    triple: "x86_64-pc-windows-msvc",
    bunTarget: "bun-windows-x64",
    ext: ".exe",
  },
  "darwin-x64": {
    triple: "x86_64-apple-darwin",
    bunTarget: "bun-darwin-x64",
    ext: "",
  },
  "darwin-arm64": {
    triple: "aarch64-apple-darwin",
    bunTarget: "bun-darwin-arm64",
    ext: "",
  },
  "linux-x64": {
    triple: "x86_64-unknown-linux-gnu",
    bunTarget: "bun-linux-x64",
    ext: "",
  },
};

function main(): void {
  const key = `${process.platform}-${process.arch}`;
  const spec = PLATFORMS[key];
  if (!spec) {
    console.error(
      `[build-binary] Unsupported host platform: ${key}. Supported: ${Object.keys(
        PLATFORMS,
      ).join(", ")}`,
    );
    process.exit(1);
  }

  const serverRoot = path.resolve(__dirname, "..");
  const entrypoint = path.join(serverRoot, "src", "main.ts");
  const binariesDir = path.resolve(serverRoot, "..", "tauri", "binaries");
  const outFile = path.join(
    binariesDir,
    `auto-exit-server-${spec.triple}${spec.ext}`,
  );

  fs.mkdirSync(binariesDir, { recursive: true });

  console.log(`[build-binary] target: ${spec.triple}`);
  console.log(`[build-binary] entry:  ${entrypoint}`);
  console.log(`[build-binary] out:    ${outFile}`);

  const result = spawnSync(
    "bun",
    [
      "build",
      entrypoint,
      "--compile",
      `--target=${spec.bunTarget}`,
      "--outfile",
      outFile,
    ],
    { stdio: "inherit", cwd: serverRoot, shell: process.platform === "win32" },
  );

  if (result.status !== 0) {
    console.error("[build-binary] bun build failed");
    process.exit(result.status ?? 1);
  }

  // Drizzle migrations: el server las lee de filesystem en runtime via
  // `DRIZZLE_MIGRATIONS` env var. Las copiamos al lado del binario para
  // que Tauri pueda bundlearlas como resource y el sidecar las encuentre.
  const migrationsSrc = path.join(serverRoot, "drizzle");
  const migrationsDst = path.join(binariesDir, "drizzle");
  if (fs.existsSync(migrationsSrc)) {
    fs.cpSync(migrationsSrc, migrationsDst, { recursive: true });
    console.log(`[build-binary] copied migrations to ${migrationsDst}`);
  } else {
    console.warn(
      `[build-binary] no migrations folder at ${migrationsSrc}; the sidecar will fail to create the DB schema at first launch`,
    );
  }

  console.log(`[build-binary] done`);
}

main();
