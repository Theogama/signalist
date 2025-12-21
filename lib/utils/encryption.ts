/**
 * Encryption utility for sensitive data like API tokens
 * Uses Node.js crypto module for AES-256-GCM encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment variable or generate a default
 * In production, BETTER_AUTH_SECRET should be set
 */
function getEncryptionKey(): string {
  const key = process.env.BETTER_AUTH_SECRET || process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  if (key === 'default-encryption-key-change-in-production') {
    console.warn('[Encryption] Using default encryption key. Set BETTER_AUTH_SECRET or ENCRYPTION_KEY in production!');
  }
  return key;
}

/**
 * Derive a key from the master key using scrypt
 */
async function deriveKey(salt: Buffer): Promise<Buffer> {
  const masterKey = getEncryptionKey();
  return (await scryptAsync(masterKey, salt, KEY_LENGTH)) as Buffer;
}

/**
 * Encrypt a string value
 */
export async function encrypt(value: string): Promise<string> {
  try {
    const salt = randomBytes(SALT_LENGTH);
    const key = await deriveKey(salt);
    const iv = randomBytes(IV_LENGTH);
    
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(value, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      encrypted,
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('[Encryption] Error encrypting value:', error);
    throw new Error('Failed to encrypt value');
  }
}

/**
 * Decrypt a string value
 */
export async function decrypt(encryptedValue: string): Promise<string> {
  try {
    const combined = Buffer.from(encryptedValue, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    const key = await deriveKey(salt);
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[Encryption] Error decrypting value:', error);
    throw new Error('Failed to decrypt value');
  }
}

/**
 * Encrypt an object (converts to JSON first)
 */
export async function encryptObject<T extends Record<string, any>>(obj: T): Promise<string> {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt an object (parses JSON after decryption)
 */
export async function decryptObject<T extends Record<string, any>>(encryptedValue: string): Promise<T> {
  const decrypted = await decrypt(encryptedValue);
  return JSON.parse(decrypted) as T;
}

/**
 * Encrypted token structure for key rotation support
 */
export interface EncryptedToken {
  data: string; // Base64 encrypted data
  keyVersion?: number; // Key version for rotation support
  algorithm: string; // Algorithm used (for future compatibility)
}

/**
 * Encrypt token with version tracking (for key rotation)
 */
export async function encryptToken(token: string, keyVersion?: number): Promise<EncryptedToken> {
  const encrypted = await encrypt(token);
  return {
    data: encrypted,
    keyVersion: keyVersion || 1,
    algorithm: ALGORITHM,
  };
}

/**
 * Decrypt token (supports multiple key versions for rotation)
 */
export async function decryptToken(encryptedToken: EncryptedToken | string): Promise<string> {
  // Support legacy string format
  if (typeof encryptedToken === 'string') {
    return decrypt(encryptedToken);
  }
  
  // New format with version tracking
  return decrypt(encryptedToken.data);
}

/**
 * Rotate encryption key (re-encrypts all tokens with new key)
 * Note: This requires access to all encrypted tokens in the database
 * Should be called during key rotation process
 */
export async function rotateKey(oldKey: string, newKey: string): Promise<void> {
  // This is a placeholder - actual implementation would:
  // 1. Set ENCRYPTION_KEY to newKey temporarily
  // 2. Iterate through all encrypted tokens in database
  // 3. Decrypt with old key, re-encrypt with new key
  // 4. Update keyVersion in database
  // 5. Update ENCRYPTION_KEY environment variable
  
  console.warn('[Encryption] Key rotation not fully implemented. Manual process required.');
  console.warn('[Encryption] Steps: 1) Set new ENCRYPTION_KEY, 2) Re-encrypt all tokens, 3) Update keyVersion');
  
  // For now, just validate the keys
  if (!oldKey || !newKey) {
    throw new Error('Both old and new keys are required for rotation');
  }
  
  if (oldKey === newKey) {
    throw new Error('Old and new keys must be different');
  }
}


