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

