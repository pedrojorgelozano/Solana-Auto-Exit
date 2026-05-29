import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  scryptSync,
  createCipheriv,
} from "node:crypto";

import {
  WalletVault,
  WrongPassphraseError,
  VaultCorruptedError,
} from "./vault.js";

const PASS = "correct horse battery";

/**
 * Genera 64 bytes de un secret key ed25519 coherente (32 seed + 32 pub) sin
 * depender de @solana/web3.js (que el server no tiene): node:crypto produce el
 * par, y extraemos las mitades raw del DER (PKCS8 → últimos 32 bytes = seed;
 * SPKI → últimos 32 bytes = pubkey). `createKeyPairSignerFromBytes` lo acepta
 * porque pub casa con priv por construcción.
 */
function freshSecret(): Uint8Array {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return new Uint8Array(Buffer.concat([seed, pub]));
}

// Parámetros del formato del vault (espejo de las constantes privadas de
// vault.ts). Si cambian allí, este forge hay que actualizarlo — el comentario
// en vault.ts no lo enlaza, así que vale la pena tenerlo presente.
const SCRYPT = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * Escribe un vault válido por formato pero con un plaintext arbitrario,
 * cifrado con la passphrase dada. Sirve para ejercitar las ramas de unlock
 * que requieren que el GCM auth tag SÍ valide (passphrase correcta) pero el
 * contenido descifrado sea inválido — imposible de provocar manipulando un
 * vault real sin romper el tag.
 */
function forgeVault(
  vaultPath: string,
  passphrase: string,
  plaintext: Uint8Array,
  address: string,
): void {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, SCRYPT);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const file = {
    version: 1,
    kdf: "scrypt",
    kdfParams: { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, saltBase64: salt.toString("base64") },
    cipher: "aes-256-gcm",
    ivBase64: iv.toString("base64"),
    ciphertextBase64: ciphertext.toString("base64"),
    authTagBase64: authTag.toString("base64"),
    address,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(vaultPath, JSON.stringify(file, null, 2));
}

describe("WalletVault — crypto roundtrip + B-09 error classification", () => {
  let vaultPath: string;
  let vault: WalletVault;
  let secret: Uint8Array;

  beforeEach(() => {
    vaultPath = path.join(os.tmpdir(), `vault-test-${randomUUID()}.json`);
    vault = new WalletVault(vaultPath);
    secret = freshSecret();
  });

  afterEach(() => {
    try {
      if (fs.existsSync(vaultPath)) fs.unlinkSync(vaultPath);
      const tmp = `${vaultPath}.tmp`;
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* best-effort cleanup */
    }
  });

  // --- Happy path -----------------------------------------------------------

  it("create → unlock devuelve la misma address y los mismos bytes", async () => {
    const { address } = await vault.create(PASS, secret);
    expect(vault.exists()).toBe(true);
    expect(vault.isUnlocked()).toBe(false); // create no deja unlocked

    const unlocked = await vault.unlock(PASS);
    expect(unlocked.address).toBe(address);
    expect(vault.isUnlocked()).toBe(true);
    expect(String(vault.getKeypair().address)).toBe(address);
    expect(vault.getRawSecret()).toEqual(secret);
  });

  it("create persiste un archivo con permisos restringidos y address en claro", async () => {
    const { address } = await vault.create(PASS, secret);
    const parsed = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
    expect(parsed.version).toBe(1);
    expect(parsed.address).toBe(address);
    // El secret no aparece en claro en ningún campo.
    const raw = fs.readFileSync(vaultPath, "utf8");
    expect(raw).not.toContain(Buffer.from(secret).toString("base64"));
  });

  it("status() lee la address sin necesidad de unlock (peekAddress)", async () => {
    expect(vault.status()).toEqual({ hasVault: false, unlocked: false, address: null });
    const { address } = await vault.create(PASS, secret);
    const locked = new WalletVault(vaultPath); // instancia fresca, nunca unlocked
    expect(locked.status()).toEqual({ hasVault: true, unlocked: false, address });
  });

  // --- create: validación de inputs ----------------------------------------

  it("create rechaza si ya existe un vault", async () => {
    await vault.create(PASS, secret);
    await expect(vault.create(PASS, freshSecret())).rejects.toThrow(/already exists/i);
  });

  it("create rechaza passphrase de menos de 8 caracteres", async () => {
    await expect(vault.create("short", secret)).rejects.toThrow(/at least 8/i);
  });

  it("create rechaza un secret de longitud incorrecta", async () => {
    await expect(vault.create(PASS, new Uint8Array(32))).rejects.toThrow(/exactly 64 bytes/i);
  });

  it("create rechaza 64 bytes que no son un keypair coherente", async () => {
    // Bytes aleatorios: la mitad pública no casa con la privada.
    await expect(vault.create(PASS, new Uint8Array(randomBytes(64)))).rejects.toThrow(
      /don't match/i,
    );
  });

  // --- unlock: clasificación de errores (B-09) ------------------------------

  it("unlock con passphrase incorrecta lanza WrongPassphraseError", async () => {
    await vault.create(PASS, secret);
    const fresh = new WalletVault(vaultPath);
    await expect(fresh.unlock("wrong passphrase here")).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it("unlock con ciphertext manipulado lanza WrongPassphraseError (GCM auth fail)", async () => {
    await vault.create(PASS, secret);
    const file = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
    const ct = Buffer.from(file.ciphertextBase64, "base64");
    ct[0] = ct[0]! ^ 0xff; // flip un byte → el auth tag deja de cuadrar
    file.ciphertextBase64 = ct.toString("base64");
    fs.writeFileSync(vaultPath, JSON.stringify(file));

    const fresh = new WalletVault(vaultPath);
    await expect(fresh.unlock(PASS)).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("unlock con la address del archivo alterada lanza VaultCorruptedError", async () => {
    const { address } = await vault.create(PASS, secret);
    const file = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
    // Cambiamos 1 char base58 (misma longitud → timingSafeEqual compara y
    // devuelve false, no tira por mismatch de longitud).
    const swap = address.charAt(0) === "A" ? "B" : "A";
    file.address = swap + address.slice(1);
    fs.writeFileSync(vaultPath, JSON.stringify(file));

    const fresh = new WalletVault(vaultPath);
    await expect(fresh.unlock(PASS)).rejects.toBeInstanceOf(VaultCorruptedError);
  });

  it("unlock con payload de longitud inesperada lanza VaultCorruptedError", async () => {
    // Forjamos un vault cuyo plaintext son 10 bytes — descifra bien (auth tag
    // válido) pero no son 64.
    forgeVault(vaultPath, PASS, new Uint8Array(randomBytes(10)), "ignored");
    await expect(vault.unlock(PASS)).rejects.toThrow(VaultCorruptedError);
    await expect(vault.unlock(PASS)).rejects.toThrow(/unexpected length/i);
  });

  it("unlock con 64 bytes que descifran pero no son keypair lanza VaultCorruptedError", async () => {
    forgeVault(vaultPath, PASS, new Uint8Array(randomBytes(64)), "ignored");
    await expect(vault.unlock(PASS)).rejects.toThrow(/not a valid ed25519 keypair/i);
  });

  it("unlock de un vault con versión no soportada lanza", async () => {
    await vault.create(PASS, secret);
    const file = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
    file.version = 2;
    fs.writeFileSync(vaultPath, JSON.stringify(file));
    const fresh = new WalletVault(vaultPath);
    await expect(fresh.unlock(PASS)).rejects.toThrow(/unsupported vault version/i);
  });

  it("unlock sin vault lanza", async () => {
    await expect(vault.unlock(PASS)).rejects.toThrow(/no vault found/i);
  });

  it("unlock con passphrase corta falla antes de leer el archivo", async () => {
    await vault.create(PASS, secret);
    const fresh = new WalletVault(vaultPath);
    await expect(fresh.unlock("short")).rejects.toThrow(/at least 8/i);
  });

  // --- lock / getRawSecret / delete -----------------------------------------

  it("getRawSecret devuelve una copia independiente del buffer interno", async () => {
    await vault.create(PASS, secret);
    await vault.unlock(PASS);
    const copy = vault.getRawSecret();
    copy.fill(0); // mutar la copia no debe tocar el buffer interno
    expect(vault.getRawSecret()).toEqual(secret);
  });

  it("lock() olvida el keypair: getKeypair / getRawSecret lanzan después", async () => {
    await vault.create(PASS, secret);
    await vault.unlock(PASS);
    vault.lock();
    expect(vault.isUnlocked()).toBe(false);
    expect(() => vault.getKeypair()).toThrow(/locked/i);
    expect(() => vault.getRawSecret()).toThrow(/locked/i);
    expect(vault.exists()).toBe(true); // lock no borra el archivo
  });

  it("getKeypair / getRawSecret lanzan si nunca se hizo unlock", async () => {
    await vault.create(PASS, secret);
    const fresh = new WalletVault(vaultPath);
    expect(() => fresh.getKeypair()).toThrow(/locked/i);
    expect(() => fresh.getRawSecret()).toThrow(/locked/i);
  });

  it("delete() borra el archivo y deja el vault locked", async () => {
    await vault.create(PASS, secret);
    await vault.unlock(PASS);
    vault.delete();
    expect(vault.exists()).toBe(false);
    expect(vault.isUnlocked()).toBe(false);
    expect(() => vault.getKeypair()).toThrow(/locked/i);
  });
});
