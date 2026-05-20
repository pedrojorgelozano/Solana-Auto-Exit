import fs from "node:fs";
import path from "node:path";
import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import {
  createKeyPairSignerFromBytes,
  type KeyPairSigner,
} from "@solana/kit";

/**
 * Formato persistente del vault. Diseño:
 *  - KDF: scrypt (incluido en Node, sin dependencias externas; misma familia
 *    de KDF que usa Solana CLI y Phantom para sus keystores).
 *  - Cipher: AES-256-GCM (auth tag protege contra manipulación).
 *  - Plaintext: los 64 bytes del secret key (32 seed + 32 public) de ed25519.
 *  - Address pública guardada en claro como sanity-check legible.
 */
interface VaultFileV1 {
  version: 1;
  kdf: "scrypt";
  kdfParams: {
    N: number;
    r: number;
    p: number;
    saltBase64: string;
  };
  cipher: "aes-256-gcm";
  ivBase64: string;
  ciphertextBase64: string;
  authTagBase64: string;
  /** Solana address derivada del secret. Se valida al hacer unlock. */
  address: string;
  /** ISO timestamp informativo. */
  createdAt: string;
}

const SCRYPT_N = 32_768; // ~32 MB de coste de memoria
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024; // límite de memoria de Node

const KEY_LENGTH = 32; // AES-256
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // AES-GCM standard
const SECRET_KEY_LENGTH = 64; // ed25519: 32 priv + 32 pub

export interface VaultStatus {
  hasVault: boolean;
  unlocked: boolean;
  /** Solo se devuelve si hay vault y la podemos leer (no requiere unlock). */
  address: string | null;
}

export class WalletVault {
  private readonly vaultPath: string;
  private unlockedKeypair: KeyPairSigner | null = null;
  private unlockedAddress: string | null = null;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  exists(): boolean {
    return fs.existsSync(this.vaultPath);
  }

  isUnlocked(): boolean {
    return this.unlockedKeypair !== null;
  }

  status(): VaultStatus {
    return {
      hasVault: this.exists(),
      unlocked: this.isUnlocked(),
      address: this.unlockedAddress ?? this.peekAddress(),
    };
  }

  /**
   * Crea un nuevo vault encriptando los 64 bytes del secret key con la
   * passphrase. Lanza si ya existe (evita sobrescribir por accidente).
   */
  async create(
    passphrase: string,
    secretKey: Uint8Array,
  ): Promise<{ address: string }> {
    if (this.exists()) {
      throw new Error(
        "A vault already exists at this path. Delete it first if you want to recreate.",
      );
    }
    this.requireValidPassphrase(passphrase);
    this.requireValidSecretKey(secretKey);

    // Derivamos la address del secret antes de encriptar (sanity + storage).
    const signer = await createKeyPairSignerFromBytes(secretKey);
    const address = String(signer.address);

    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = this.deriveKey(passphrase, salt);

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(secretKey),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const file: VaultFileV1 = {
      version: 1,
      kdf: "scrypt",
      kdfParams: {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        saltBase64: salt.toString("base64"),
      },
      cipher: "aes-256-gcm",
      ivBase64: iv.toString("base64"),
      ciphertextBase64: ciphertext.toString("base64"),
      authTagBase64: authTag.toString("base64"),
      address,
      createdAt: new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(this.vaultPath), { recursive: true });
    // Escritura atómica: temp + rename para evitar dejar el vault corrupto
    // si el proceso muere a mitad.
    const tmpPath = `${this.vaultPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2), { mode: 0o600 });
    fs.renameSync(tmpPath, this.vaultPath);

    return { address };
  }

  /**
   * Descifra el vault con la passphrase y guarda el keypair en memoria.
   * El authTag de GCM garantiza que una passphrase incorrecta produce
   * un error claro (no devuelve basura silenciosamente).
   */
  async unlock(passphrase: string): Promise<{ address: string }> {
    if (!this.exists()) {
      throw new Error("No vault found. Create one first.");
    }
    this.requireValidPassphrase(passphrase);

    const file = this.readVaultFile();

    const salt = Buffer.from(file.kdfParams.saltBase64, "base64");
    const iv = Buffer.from(file.ivBase64, "base64");
    const authTag = Buffer.from(file.authTagBase64, "base64");
    const ciphertext = Buffer.from(file.ciphertextBase64, "base64");
    const key = this.deriveKey(passphrase, salt, file.kdfParams);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted: Buffer;
    try {
      decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
    } catch {
      throw new Error("Bad passphrase, or the vault file has been tampered.");
    }

    if (decrypted.length !== SECRET_KEY_LENGTH) {
      throw new Error(
        `Decrypted payload has unexpected length ${decrypted.length} (expected ${SECRET_KEY_LENGTH}).`,
      );
    }

    const signer = await createKeyPairSignerFromBytes(
      new Uint8Array(decrypted),
    );
    const derivedAddr = String(signer.address);

    // Sanity: el address derivado debe coincidir con el del archivo.
    if (
      !timingSafeEqual(
        Buffer.from(derivedAddr),
        Buffer.from(file.address),
      )
    ) {
      throw new Error("Vault address mismatch after decryption.");
    }

    this.unlockedKeypair = signer;
    this.unlockedAddress = derivedAddr;
    return { address: derivedAddr };
  }

  /** Olvida el keypair en memoria. El vault en disco no se toca. */
  lock(): void {
    this.unlockedKeypair = null;
    this.unlockedAddress = null;
  }

  /** Para inyectar en adapters. Lanza si el vault está locked. */
  getKeypair(): KeyPairSigner {
    if (!this.unlockedKeypair) {
      throw new Error("Vault is locked. Unlock it first.");
    }
    return this.unlockedKeypair;
  }

  /** Borra el vault en disco. Operación irreversible. */
  delete(): void {
    if (this.exists()) fs.unlinkSync(this.vaultPath);
    this.lock();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private requireValidPassphrase(passphrase: string): void {
    if (typeof passphrase !== "string" || passphrase.length < 8) {
      throw new Error("Passphrase must be at least 8 characters.");
    }
  }

  private requireValidSecretKey(secretKey: Uint8Array): void {
    if (!(secretKey instanceof Uint8Array)) {
      throw new Error("Secret key must be a Uint8Array.");
    }
    if (secretKey.length !== SECRET_KEY_LENGTH) {
      throw new Error(
        `Secret key must be exactly ${SECRET_KEY_LENGTH} bytes (got ${secretKey.length}).`,
      );
    }
  }

  private deriveKey(
    passphrase: string,
    salt: Buffer,
    params: { N: number; r: number; p: number } = {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    },
  ): Buffer {
    return scryptSync(passphrase, salt, KEY_LENGTH, {
      N: params.N,
      r: params.r,
      p: params.p,
      maxmem: SCRYPT_MAXMEM,
    });
  }

  private readVaultFile(): VaultFileV1 {
    const raw = fs.readFileSync(this.vaultPath, "utf8");
    const parsed = JSON.parse(raw) as VaultFileV1;
    if (parsed.version !== 1) {
      throw new Error(`Unsupported vault version: ${parsed.version}.`);
    }
    return parsed;
  }

  /** Lee la address pública sin descifrar nada. */
  private peekAddress(): string | null {
    if (!this.exists()) return null;
    try {
      return this.readVaultFile().address;
    } catch {
      return null;
    }
  }
}
