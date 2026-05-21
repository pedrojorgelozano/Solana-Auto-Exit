import { isIP } from "node:net";

/**
 * Defensa SSRF para la URL del RPC.
 *
 * Modelo de amenaza: un actor con acceso a la API tRPC (en single-user
 * self-hosted con bind localhost, somos nosotros mismos; en un escenario
 * expuesto vía túnel/Tailscale o si alguna vulnerabilidad permite que un
 * tercero llame a la API, sería ese tercero) podría apuntar `rpcUrl` a:
 *
 *  - `http://169.254.169.254/...` → endpoint de metadata en AWS/GCP/Azure,
 *    devolvería credenciales temporales si el bot se ejecuta en una VM cloud.
 *  - `http://127.0.0.1:<otro-puerto>` → pivot a otros servicios locales
 *    (panel admin de Plex, electron app de Backpack, etc.).
 *  - `file:///etc/passwd`, `data:`, `javascript:` → exfiltración o RCE
 *    según cómo el fetch downstream maneje schemes raros.
 *
 * Política aplicada:
 *  - Solo se aceptan schemes `http`, `https`, `ws`, `wss`.
 *  - Bloqueado: cloud metadata (169.254.x.x), all-interfaces (0.0.0.0, ::),
 *    IPv6 link-local (fe80::/10).
 *  - Loopback (`127.x.x.x`, `::1`, `localhost`) bloqueado por defecto.
 *    Escape hatch: `ALLOW_LOOPBACK_RPC=true` lo permite, para usuarios que
 *    corren `solana-test-validator` en la misma máquina. Documentar en
 *    SECURITY.md.
 *
 * Lo que NO bloqueamos a propósito:
 *  - LANs privadas (10/8, 172.16/12, 192.168/16) — un usuario power puede
 *    correr el RPC en otra máquina de su LAN; bloquearlas rompería ese caso
 *    sin ganancia real (atacante en LAN puede pivotar de mil otras maneras).
 *  - Tailscale CGNAT (100.64.0.0/10) — RPC sobre Tailscale es un patrón
 *    legítimo para usuarios con un solo nodo Solana compartido.
 *  - DNS rebinding — validamos por literal del hostname; no resolvemos para
 *    evitar latencia y race conditions. Defensa-en-profundidad real contra
 *    rebinding requiere DNS pinning en el cliente HTTP, fuera de alcance.
 */
export function assertSafeRpcUrl(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("rpcUrl is not a valid URL.");
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new Error(
      `rpcUrl scheme "${url.protocol}" is not allowed. Use http(s) or ws(s).`,
    );
  }

  // Credenciales embebidas (`https://user:pass@host`): se filtrarían en
  // cualquier log que muestre el rpcUrl. Si necesitas autenticar contra un
  // RPC, usa cabeceras (Helius/Triton usan el path ?api-key=) o un proxy
  // que las inyecte. Una passphrase en la URL es siempre el patrón malo.
  if (url.username !== "" || url.password !== "") {
    throw new Error(
      "rpcUrl must not contain embedded credentials (user:pass@host). Use a token in the query string or an authenticating proxy instead.",
    );
  }

  // Node 22 URL parser deja los corchetes en hostname para literales IPv6
  // (ej "[::1]" en vez de "::1"). Hay que normalizar antes de pasarlos a
  // `isIP()` o comparar contra `"::"` / `"::1"`. Bug encontrado por tests.
  const host = stripIPv6Brackets(url.hostname.toLowerCase());

  if (isAllInterfaces(host)) {
    throw new Error(`rpcUrl host "${host}" is not allowed (all-interfaces).`);
  }
  if (isMetadataHost(host)) {
    throw new Error(
      `rpcUrl host "${host}" is not allowed (cloud metadata endpoint).`,
    );
  }
  if (isIPv6LinkLocal(host)) {
    throw new Error(`rpcUrl host "${host}" is not allowed (IPv6 link-local).`);
  }
  if (isLoopbackHost(host) && !allowLoopback()) {
    throw new Error(
      `rpcUrl host "${host}" is not allowed (loopback). Set ALLOW_LOOPBACK_RPC=true to allow a local test validator.`,
    );
  }
}

const ALLOWED_SCHEMES = new Set(["http:", "https:", "ws:", "wss:"]);

function stripIPv6Brackets(h: string): string {
  return h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
}

function allowLoopback(): boolean {
  return process.env.ALLOW_LOOPBACK_RPC === "true";
}

function isLoopbackHost(host: string): boolean {
  if (host === "localhost") return true;
  if (host === "::1") return true;
  // node:net.isIP devuelve 4 si es IPv4, 6 si IPv6, 0 si no es IP.
  if (isIP(host) === 4) {
    const first = parseInt(host.split(".")[0] ?? "0", 10);
    return first === 127;
  }
  return false;
}

function isMetadataHost(host: string): boolean {
  if (isIP(host) !== 4) return false;
  const parts = host.split(".").map((p) => parseInt(p, 10));
  return parts[0] === 169 && parts[1] === 254;
}

function isAllInterfaces(host: string): boolean {
  return host === "0.0.0.0" || host === "::" || host === "0:0:0:0:0:0:0:0";
}

function isIPv6LinkLocal(host: string): boolean {
  if (isIP(host) !== 6) return false;
  // fe80::/10 — primeros 10 bits son 1111111010. Los hostnames IPv6 que
  // empiezan con "fe8", "fe9", "fea", "feb" caen en el rango.
  const prefix = host.slice(0, 3).toLowerCase();
  return prefix === "fe8" || prefix === "fe9" || prefix === "fea" || prefix === "feb";
}
