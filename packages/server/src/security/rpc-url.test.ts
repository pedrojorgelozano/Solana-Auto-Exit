import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertSafeRpcUrl } from "./rpc-url.js";

function expectBlocked(url: string, reason: RegExp): void {
  expect(() => assertSafeRpcUrl(url)).toThrow(reason);
}
function expectAllowed(url: string): void {
  expect(() => assertSafeRpcUrl(url)).not.toThrow();
}

describe("assertSafeRpcUrl", () => {
  beforeEach(() => {
    delete process.env.ALLOW_LOOPBACK_RPC;
  });
  afterEach(() => {
    delete process.env.ALLOW_LOOPBACK_RPC;
  });

  it("rejects invalid URLs", () => {
    expectBlocked("not a url", /valid URL/);
    expectBlocked("", /valid URL/);
  });

  it("rejects non-http(s)/ws(s) schemes", () => {
    expectBlocked("file:///etc/passwd", /scheme/);
    expectBlocked("data:text/plain;base64,aGk=", /scheme/);
    expectBlocked("javascript:alert(1)", /scheme/);
    expectBlocked("ftp://example.com/", /scheme/);
  });

  it("rejects URLs with embedded credentials (H-02)", () => {
    expectBlocked("https://user:pass@rpc.example.com", /credentials/);
    expectBlocked("https://user@rpc.example.com", /credentials/);
    expectBlocked("https://:pass@rpc.example.com", /credentials/);
  });

  it("blocks loopback by default", () => {
    expectBlocked("http://127.0.0.1:8899", /loopback/);
    expectBlocked("http://localhost:8899", /loopback/);
    expectBlocked("http://[::1]:8899", /loopback/);
    expectBlocked("http://127.255.255.255", /loopback/);
  });

  it("allows loopback when ALLOW_LOOPBACK_RPC=true", () => {
    process.env.ALLOW_LOOPBACK_RPC = "true";
    expectAllowed("http://127.0.0.1:8899");
    expectAllowed("http://localhost:8899");
    expectAllowed("http://[::1]:8899");
  });

  it("only honors the literal string 'true' for the escape hatch", () => {
    // Comportamiento conservador: 1/TRUE/yes no funcionan, intencional para
    // que el opt-in sea explícito. Documentado en SECURITY.md.
    process.env.ALLOW_LOOPBACK_RPC = "1";
    expectBlocked("http://127.0.0.1:8899", /loopback/);
    process.env.ALLOW_LOOPBACK_RPC = "TRUE";
    expectBlocked("http://127.0.0.1:8899", /loopback/);
    process.env.ALLOW_LOOPBACK_RPC = "yes";
    expectBlocked("http://127.0.0.1:8899", /loopback/);
  });

  it("blocks AWS/GCP metadata endpoint always", () => {
    expectBlocked(
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      /metadata/,
    );
    expectBlocked("http://169.254.1.2", /metadata/);
  });

  it("blocks all-interfaces", () => {
    expectBlocked("http://0.0.0.0:7777", /all-interfaces/);
    expectBlocked("http://[::]:7777", /all-interfaces/);
  });

  it("blocks IPv6 link-local", () => {
    expectBlocked("http://[fe80::1]:7777", /link-local/);
    expectBlocked("http://[feb0::1]:7777", /link-local/);
  });

  it("allows LAN private ranges (power-user nodo local)", () => {
    expectAllowed("http://10.0.0.5:8899");
    expectAllowed("http://172.16.1.1:8899");
    expectAllowed("http://192.168.1.50:8899");
  });

  it("allows Tailscale CGNAT (100.64.0.0/10)", () => {
    expectAllowed("http://100.64.0.1:8899");
    expectAllowed("http://100.127.255.254:8899");
  });

  it("allows public Solana RPCs", () => {
    expectAllowed("https://api.mainnet-beta.solana.com");
    expectAllowed("https://api.devnet.solana.com");
    expectAllowed("https://mainnet.helius-rpc.com/?api-key=xxx");
  });

  it("is case-insensitive on host", () => {
    expectBlocked("http://LOCALHOST:8899", /loopback/);
    // Hostnames se normalizan por URL parser; los IPs literales también.
  });

  it("permits ws(s) for websocket RPCs", () => {
    expectAllowed("wss://mainnet.helius-rpc.com/");
    expectAllowed("ws://192.168.1.50:8900");
  });
});
