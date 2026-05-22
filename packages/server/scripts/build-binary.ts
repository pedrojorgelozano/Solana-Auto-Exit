/**
 * Prepara el "sidecar" del server para Tauri.
 *
 * NO compila ni bundlea el server: `bun --compile` no puede empaquetar las
 * dependencias WASM/nativas, y el bundler de Bun tampoco (el WASM de Orca; y
 * Meteora, que el engine carga vía `createRequire`). Ver ADR-031.
 *
 * En su lugar produce, en `packages/tauri/binaries/`:
 *
 *   auto-exit-server-<triple>[.exe]  -> copia del runtime `bun` (el sidecar)
 *   server-app/                      -> el server desplegado con `pnpm deploy`
 *                                       (src + drizzle + node_modules real)
 *
 * Tauri bundlea el runtime `bun` como `externalBin` (de ahí el naming
 * `<name>-<triple>[.exe]`) y `server-app/` como `resources`. En runtime el
 * `setup()` de Rust hace spawn del sidecar pasándole `server-app/src/main.ts`
 * como argumento; Bun lo ejecuta resolviendo las deps desde
 * `server-app/node_modules`.
 *
 * El deploy usa `--node-linker=hoisted` para que `server-app/node_modules`
 * sea plano y sin symlinks — relocatable, empaquetable por `tauri build`.
 *
 * Requisitos:
 *   - Bun en PATH (`irm bun.sh/install.ps1 | iex` en Windows).
 *   - Se copia el runtime del host: hay que ejecutar esto en el OS destino.
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

// Host platform → target triple Rust style (lo que Tauri espera para el
// naming del sidecar) + extensión de ejecutable.
interface PlatformSpec {
  triple: string;
  ext: string;
}

const PLATFORMS: Record<string, PlatformSpec> = {
  "win32-x64": { triple: "x86_64-pc-windows-msvc", ext: ".exe" },
  "darwin-x64": { triple: "x86_64-apple-darwin", ext: "" },
  "darwin-arm64": { triple: "aarch64-apple-darwin", ext: "" },
  "linux-x64": { triple: "x86_64-unknown-linux-gnu", ext: "" },
};

// Subdirectorios del paquete server que NO deben viajar en el sidecar:
//  - data/: DB y wallet.vault de DESARROLLO (secreto). El runtime usa rutas
//    de app-data via env vars, así que esto sería solo basura sensible.
//  - scripts/ y drizzle.config.ts: solo se usan en build/dev.
const PRUNE_FROM_DEPLOY = ["data", "scripts", "drizzle.config.ts"];

// Paquetes de node_modules a eliminar del sidecar: corre con Bun y usa
// `bun:sqlite`, así que `better-sqlite3` (módulo nativo, ~67 MB con sus
// intermedios de compilación MSVC) es puro peso muerto. Sigue siendo dep del
// server para el path Node/dev/Docker — por eso se poda aquí, no del manifest.
const PRUNE_DEPS = ["better-sqlite3"];

/** Primer `bun` ejecutable encontrado en PATH. */
function findBunExe(): string {
  const exe = process.platform === "win32" ? "bun.exe" : "bun";
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  console.error("[build-binary] bun not found on PATH");
  process.exit(1);
}

/**
 * Env sin las variables `npm_*` / `pnpm_*` que inyecta un `pnpm run` padre.
 * Heredadas, hacen que un `pnpm` anidado dispare el chequeo de deps + un
 * `install --production` que quiere purgar node_modules y aborta sin TTY.
 * Limpiándolas, el `pnpm` hijo se comporta como una invocación fresca.
 */
function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(npm_|pnpm_)/i.test(key)) continue;
    env[key] = value;
  }
  return env;
}

/**
 * spawnSync de un comando. En Windows va por shell con un único string
 * entrecomillado: así funcionan los `.cmd` (pnpm) y los paths con espacios,
 * y se evita la deprecation DEP0190 de Node (array de args + shell:true).
 */
function run(exe: string, args: string[], cwd: string): void {
  const env = cleanEnv();
  const result =
    process.platform === "win32"
      ? spawnSync(
          [exe, ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" "),
          { stdio: "inherit", cwd, shell: true, env },
        )
      : spawnSync(exe, args, { stdio: "inherit", cwd, env });

  if (result.status !== 0) {
    console.error(`[build-binary] \`${exe}\` failed`);
    process.exit(result.status ?? 1);
  }
}

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
  const repoRoot = path.resolve(serverRoot, "..", "..");
  const binariesDir = path.resolve(serverRoot, "..", "tauri", "binaries");
  const serverAppDir = path.join(binariesDir, "server-app");
  const runtimeFile = path.join(
    binariesDir,
    `auto-exit-server-${spec.triple}${spec.ext}`,
  );

  fs.mkdirSync(binariesDir, { recursive: true });

  console.log(`[build-binary] target: ${spec.triple}`);

  // 1. `pnpm deploy` del server → server-app/ con su propio node_modules.
  //    `--node-linker=hoisted`: node_modules plano (estilo npm), sin symlinks
  //    ni store `.pnpm` — relocatable, empaquetable tal cual por Tauri. Solo
  //    funciona con `verifyDepsBeforeRun: false` en pnpm-workspace.yaml: si no,
  //    pnpm ve el cambio de linker e intenta purgar el node_modules del
  //    workspace (aborta sin TTY).
  fs.rmSync(serverAppDir, { recursive: true, force: true });
  console.log(`[build-binary] deploying server -> ${serverAppDir}`);
  run(
    "pnpm",
    [
      "--filter",
      "@solana-auto-exit/server",
      "deploy",
      "--prod",
      "--legacy",
      "--node-linker=hoisted",
      serverAppDir,
    ],
    repoRoot,
  );

  // 2. Pruning de lo que no debe viajar (sobre todo data/: DB + wallet.vault
  //    de desarrollo) y de los node_modules muertos en el sidecar.
  for (const entry of PRUNE_FROM_DEPLOY) {
    const target = path.join(serverAppDir, entry);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[build-binary] pruned ${entry} from deploy`);
    }
  }
  for (const dep of PRUNE_DEPS) {
    const target = path.join(serverAppDir, "node_modules", dep);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[build-binary] pruned node_modules/${dep} from deploy`);
    }
  }

  // 3. Runtime de Bun: se copia y se renombra al naming de sidecar que Tauri
  //    espera. El sidecar ES el runtime de Bun.
  const bunExe = findBunExe();
  fs.copyFileSync(bunExe, runtimeFile);
  console.log(`[build-binary] copied bun runtime ${bunExe} -> ${runtimeFile}`);

  console.log(`[build-binary] done`);
}

main();
