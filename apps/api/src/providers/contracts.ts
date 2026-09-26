/**
 * Provider contracts. Every external concern is reached only through one of these interfaces;
 * the concrete adapter is chosen at boot from config (ADR-0002). Application code depends on the
 * interface + token, never on an SDK type — so changing cloud/on-prem is a config change.
 */

// --- DI tokens ---
export const STORAGE_PROVIDER = Symbol('StorageProvider');
export const SECRETS_PROVIDER = Symbol('SecretsProvider');
export const EMAIL_PROVIDER = Symbol('EmailProvider');
export const SMS_PROVIDER = Symbol('SmsProvider');
export const QUEUE_PROVIDER = Symbol('QueueProvider');
export const SCAN_PROVIDER = Symbol('ScanProvider');
export const KEY_PROVIDER = Symbol('KeyProvider');
export const VERIFICATION_PROVIDER = Symbol('VerificationProvider');

// --- Object storage ---
export interface StorageProvider {
  /** Store bytes under an opaque key. Never derive the key from a user-supplied filename. */
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  /** Short-lived URL for a controlled download, when the backend supports it. */
  presignGet(key: string, ttlSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}

// --- Secrets ---
export interface SecretsProvider {
  /** Resolve a secret by logical name/path. Returns undefined when absent. */
  get(name: string): Promise<string | undefined>;
}

// --- Email ---
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

// --- SMS / OTP delivery ---
export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

// --- Queue / background jobs ---
export interface QueueProvider {
  enqueue(queue: string, name: string, data: Record<string, unknown>): Promise<void>;
}

// --- Malware scanning ---
export interface ScanResult {
  clean: boolean;
  signature?: string;
}
export interface ScanProvider {
  scan(data: Buffer): Promise<ScanResult>;
}

// --- Encryption keys (envelope) ---
export interface ActiveKey {
  keyId: string;
  key: Buffer; // 32 bytes (AES-256)
}
export interface KeyProvider {
  getActiveKey(): Promise<ActiveKey>;
  getKey(keyId: string): Promise<Buffer>;
}

// --- Statutory verification (mock in Phase 0; real adapter stubbed) ---
export type VerificationStatus = 'verified' | 'not_found' | 'mismatch' | 'pending' | 'error';
export interface VerificationResult<T = Record<string, unknown>> {
  status: VerificationStatus;
  normalisedData?: T;
  rawResponseRef?: string;
  verifiedAt: string; // ISO-8601 UTC
  providerName: string;
}
export interface VerificationProvider {
  pan(input: { pan: string; name?: string }): Promise<VerificationResult>;
  gstin(input: { gstin: string }): Promise<VerificationResult>;
  mca(input: { registration: string }): Promise<VerificationResult>;
  bank(input: { account: string; ifsc: string; name?: string }): Promise<VerificationResult>;
  udyam(input: { udyam: string }): Promise<VerificationResult>;
}
