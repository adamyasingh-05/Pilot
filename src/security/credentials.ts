import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PILOT_KEYS_DIR } from "../core/constants.js";
import { CredentialError } from "../core/errors.js";
import type { ProviderId } from "../core/constants.js";

/**
 * Local, encrypted-at-rest credential store.
 *
 * Design goals (see docs/security.md):
 *  - Keys never leave the machine. There is no network call in this file.
 *  - Keys are encrypted on disk with AES-256-GCM using a machine-local
 *    key file that is created with 0600 permissions and never printed,
 *    logged, or transmitted.
 *  - Keys are only ever decrypted into memory for the lifetime of a
 *    single provider request and are never interpolated into prompts,
 *    tool calls, error messages, or logs.
 *  - `pilot config keys` never prints stored values — only masked
 *    previews (e.g. "sk-ant-...ab12") and metadata like "set on <date>".
 *
 * NOTE: A future version should prefer the OS-native keychain (macOS
 * Keychain / Windows Credential Manager / libsecret on Linux) via an
 * optional native module, falling back to this file-based store when
 * unavailable. The interface below is written so that swap is drop-in.
 */

interface StoredCredential {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  createdAt: string;
  preview: string; // masked preview only, e.g. "sk-ant-...ab12"
}

type CredentialFile = Partial<Record<ProviderId, StoredCredential>>;

function ensureKeysDir(): void {
  if (!fs.existsSync(PILOT_KEYS_DIR)) {
    fs.mkdirSync(PILOT_KEYS_DIR, { recursive: true, mode: 0o700 });
  }
}

function machineKeyPath(): string {
  return path.join(PILOT_KEYS_DIR, ".machine.key");
}

function credentialFilePath(): string {
  return path.join(PILOT_KEYS_DIR, "credentials.enc.json");
}

/** Gets (or creates) a local, random 256-bit key used only to encrypt
 * credentials at rest on this machine. This key itself never leaves
 * disk and is never sent anywhere. */
function getOrCreateMachineKey(): Buffer {
  ensureKeysDir();
  const keyPath = machineKeyPath();
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath);
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

function readCredentialFile(): CredentialFile {
  const filePath = credentialFilePath();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as CredentialFile;
  } catch {
    throw new CredentialError("Local credential store is corrupted.");
  }
}

function writeCredentialFile(data: CredentialFile): void {
  ensureKeysDir();
  fs.writeFileSync(credentialFilePath(), JSON.stringify(data, null, 2), {
    mode: 0o600,
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function setCredential(provider: ProviderId, apiKey: string): void {
  if (!apiKey || apiKey.trim().length < 8) {
    throw new CredentialError("Refusing to store an implausibly short API key.");
  }
  const machineKey = getOrCreateMachineKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", machineKey, iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const data = readCredentialFile();
  data[provider] = {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    createdAt: new Date().toISOString(),
    preview: maskKey(apiKey),
  };
  writeCredentialFile(data);
}

/** Decrypts and returns the raw key. Callers MUST NOT log, print, or
 * forward this value anywhere except directly into the provider SDK's
 * auth header. */
export function getCredential(provider: ProviderId): string | undefined {
  const data = readCredentialFile();
  const entry = data[provider];
  if (!entry) return undefined;
  try {
    const machineKey = getOrCreateMachineKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      machineKey,
      Buffer.from(entry.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(entry.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(entry.ciphertext, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf-8");
  } catch {
    throw new CredentialError(
      `Failed to decrypt stored credential for "${provider}". It may have been corrupted.`
    );
  }
}

export function hasCredential(provider: ProviderId): boolean {
  return Boolean(readCredentialFile()[provider]);
}

export function deleteCredential(provider: ProviderId): void {
  const data = readCredentialFile();
  delete data[provider];
  writeCredentialFile(data);
}

/** Safe-to-print metadata only. Never includes the actual key. */
export function listCredentialPreviews(): Array<{
  provider: ProviderId;
  preview: string;
  createdAt: string;
}> {
  const data = readCredentialFile();
  return (Object.entries(data) as Array<[ProviderId, StoredCredential]>).map(
    ([provider, entry]) => ({
      provider,
      preview: entry.preview,
      createdAt: entry.createdAt,
    })
  );
}
