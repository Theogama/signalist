/**
 * Verification Code Store
 * In-memory store for email verification codes
 * In production, use Redis or a database instead
 */

export interface VerificationCode {
  code: string;
  expiresAt: number;
  email: string;
}

// In-memory store for verification codes
const verificationCodes = new Map<string, VerificationCode>();

// Clean up expired codes (called on each request to avoid setInterval issues in serverless)
export function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [key, value] of verificationCodes.entries()) {
    if (value.expiresAt < now) {
      verificationCodes.delete(key);
    }
  }
}

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store a verification code
export function storeVerificationCode(email: string, code: string, expiresInMinutes: number = 10): void {
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  verificationCodes.set(email.toLowerCase(), {
    code,
    expiresAt,
    email,
  });
}

// Get a verification code
export function getVerificationCode(email: string): VerificationCode | undefined {
  cleanupExpiredCodes();
  return verificationCodes.get(email.toLowerCase());
}

// Verify a code
export function verifyCode(email: string, code: string): { valid: boolean; expired?: boolean } {
  cleanupExpiredCodes();
  const stored = verificationCodes.get(email.toLowerCase());
  
  if (!stored) {
    return { valid: false };
  }
  
  if (stored.expiresAt < Date.now()) {
    verificationCodes.delete(email.toLowerCase());
    return { valid: false, expired: true };
  }
  
  if (stored.code !== code) {
    return { valid: false };
  }
  
  return { valid: true };
}

// Delete a verification code (after successful use)
export function deleteVerificationCode(email: string): void {
  verificationCodes.delete(email.toLowerCase());
}

// Get all codes (for debugging - remove in production)
export function getAllCodes(): Map<string, VerificationCode> {
  cleanupExpiredCodes();
  return new Map(verificationCodes);
}



