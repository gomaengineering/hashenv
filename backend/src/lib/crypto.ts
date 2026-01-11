import crypto from 'crypto';

/**
 * Security-critical crypto utilities for AES-256-GCM encryption/decryption
 * 
 * IMPORTANT SECURITY NOTES:
 * - All encryption/decryption happens server-side only
 * - Encryption key must be stored in process.env.MASTER_ENCRYPTION_KEY
 * - Key must be base64-encoded and 32 bytes when decoded
 * - Never expose encryption keys to the client
 * - Never log decrypted data
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 32 bytes for AES-256
const IV_LENGTH = 16; // 16 bytes for AES-GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM authentication tag

/**
 * Get the master encryption key from environment
 * Validates that the key exists and is properly formatted
 */
function getMasterKey(): Buffer {
  const keyBase64 = process.env.MASTER_ENCRYPTION_KEY;
  
  if (!keyBase64) {
    throw new Error('MASTER_ENCRYPTION_KEY environment variable is not set');
  }

  try {
    const key = Buffer.from(keyBase64, 'base64');
    
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `MASTER_ENCRYPTION_KEY must be exactly ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} base64 characters). ` +
        `Got ${key.length} bytes`
      );
    }
    
    return key;
  } catch (error) {
    throw new Error(
      `Invalid MASTER_ENCRYPTION_KEY: must be valid base64-encoded string. ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Encrypts plaintext environment file data using AES-256-GCM
 * 
 * @param data - Plaintext string (env file content)
 * @returns Object containing encryptedData, iv, and authTag buffers
 * 
 * Security: GCM mode provides authenticated encryption, preventing tampering
 */
export function encryptEnv(data: string): { encryptedData: Buffer; iv: Buffer; authTag: Buffer } {
  const key = getMasterKey();
  
  // Generate random IV for each encryption (CRITICAL for security)
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher with GCM mode
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt the data
  let encryptedData = cipher.update(data, 'utf8');
  encryptedData = Buffer.concat([encryptedData, cipher.final()]);
  
  // Get authentication tag (proves data hasn't been tampered with)
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData,
    iv,
    authTag,
  };
}

/**
 * Decrypts encrypted environment file data using AES-256-GCM
 * 
 * @param encryptedData - Encrypted data buffer
 * @param iv - Initialization vector buffer
 * @param authTag - Authentication tag buffer
 * @returns Plaintext string (env file content)
 * 
 * Security: 
 * - Validates authentication tag before decryption (prevents tampering)
 * - Throws error if data has been modified
 * - Never logs decrypted content
 */
export function decryptEnv(
  encryptedData: Buffer,
  iv: Buffer,
  authTag: Buffer
): string {
  const key = getMasterKey();
  
  // Validate buffer sizes
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }
  
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
  }
  
  // Create decipher with GCM mode
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  // Set authentication tag (CRITICAL: validates data integrity)
  decipher.setAuthTag(authTag);
  
  try {
    // Decrypt the data
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    // Convert to string
    return decrypted.toString('utf8');
  } catch (error) {
    // If decryption fails, it likely means:
    // 1. Wrong key
    // 2. Data was tampered with
    // 3. Corrupted data
    throw new Error('Decryption failed: data may be corrupted or tampered with');
  }
}
