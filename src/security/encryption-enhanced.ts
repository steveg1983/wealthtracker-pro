/**
 * Enhanced Encryption Service
 * Provides secure encryption for sensitive financial data with key management
 */

import CryptoJS from 'crypto-js';

// Types for encryption configuration
interface EncryptionConfig {
  algorithm: 'AES' | 'AES-GCM';
  keySize: 128 | 256;
  iterations: number;
  saltLength: number;
}

interface EncryptedData {
  ciphertext: string;
  salt: string;
  iv: string;
  authTag?: string;
  algorithm: string;
  timestamp: number;
}

interface KeyDerivationOptions {
  password: string;
  salt: string;
  iterations: number;
  keySize: number;
}

class EnhancedEncryptionService {
  private config: EncryptionConfig = {
    algorithm: 'AES',
    keySize: 256,
    iterations: 10000, // PBKDF2 iterations
    saltLength: 128
  };

  private masterKey: CryptoJS.lib.WordArray | null = null;
  private keyRotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days

  /**
   * Initialize the encryption service with a user-specific key
   */
  async initialize(userIdentifier?: string): Promise<void> {
    this.masterKey = await this.deriveOrRetrieveMasterKey(userIdentifier);
  }

  /**
   * Derive master key from user credentials or device fingerprint
   */
  private async deriveOrRetrieveMasterKey(userIdentifier?: string): Promise<CryptoJS.lib.WordArray> {
    // Check if we have a stored key (encrypted with device key)
    const storedKeyData = await this.getStoredKeyData();
    
    if (storedKeyData && !this.isKeyExpired(storedKeyData.timestamp)) {
      return this.decryptStoredKey(storedKeyData);
    }

    // Generate new key
    const deviceFingerprint = await this.getDeviceFingerprint();
    const baseKey = userIdentifier || deviceFingerprint;
    
    // Generate random salt
    const salt = CryptoJS.lib.WordArray.random(this.config.saltLength / 8);
    
    // Derive key using PBKDF2
    const derivedKey = this.deriveKey({
      password: baseKey,
      salt: salt.toString(),
      iterations: this.config.iterations,
      keySize: this.config.keySize / 32
    });

    // Store the key securely
    await this.storeKey(derivedKey, salt);

    return derivedKey;
  }

  /**
   * Derive key using PBKDF2
   */
  private deriveKey(options: KeyDerivationOptions): CryptoJS.lib.WordArray {
    return CryptoJS.PBKDF2(options.password, options.salt, {
      keySize: options.keySize,
      iterations: options.iterations,
      hasher: CryptoJS.algo.SHA256
    });
  }

  /**
   * Get device fingerprint for key generation
   */
  private async getDeviceFingerprint(): Promise<string> {
    // Combine multiple device characteristics
    const fingerprints = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      screen.colorDepth.toString(),
      screen.width.toString(),
      screen.height.toString(),
      new Date().getTimezoneOffset().toString(),
      // Add WebGL fingerprint if available
      this.getWebGLFingerprint()
    ];

    // Hash the combined fingerprint
    return CryptoJS.SHA256(fingerprints.join('||')).toString();
  }

  /**
   * Get WebGL fingerprint for additional entropy
   */
  private getWebGLFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'no-webgl';

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return `${vendor}::${renderer}`;
      }
      
      return 'webgl-no-debug';
    } catch {
      return 'webgl-error';
    }
  }

  /**
   * Encrypt data with AES
   */
  encrypt<T>(data: T): EncryptedData {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    // Generate random IV
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    
    // Generate random salt for this encryption
    const salt = CryptoJS.lib.WordArray.random(this.config.saltLength / 8);
    
    // Derive encryption key from master key and salt
    const encryptionKey = this.deriveKey({
      password: this.masterKey.toString(),
      salt: salt.toString(),
      iterations: 1000,
      keySize: this.config.keySize / 32
    });

    const payload =
      data === undefined
        ? { __value: null, __type: 'undefined' }
        : { __value: data, __type: 'value' };

    // Encrypt the data
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), encryptionKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
      salt: salt.toString(CryptoJS.enc.Base64),
      iv: iv.toString(CryptoJS.enc.Base64),
      algorithm: this.config.algorithm,
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt data
   */
  decrypt<T>(encryptedData: EncryptedData): T {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    // Recreate the encryption key
    const encryptionKey = this.deriveKey({
      password: this.masterKey.toString(),
      salt: CryptoJS.enc.Base64.parse(encryptedData.salt).toString(),
      iterations: 1000,
      keySize: this.config.keySize / 32
    });

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(
      {
        ciphertext: CryptoJS.enc.Base64.parse(encryptedData.ciphertext)
      } as any,
      encryptionKey,
      {
        iv: CryptoJS.enc.Base64.parse(encryptedData.iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      throw new Error('Failed to decrypt data - invalid key or corrupted data');
    }

    try {
      const parsed = JSON.parse(decryptedText);
      if (parsed && typeof parsed === 'object' && '__type' in parsed && '__value' in parsed) {
        return (parsed.__type === 'undefined' ? undefined : parsed.__value) as T;
      }
      return parsed as T;
    } catch {
      throw new Error('Failed to decrypt data - invalid key or corrupted data');
    }
  }

  /**
   * Store the master key securely
   */
  private async storeKey(key: CryptoJS.lib.WordArray, salt: CryptoJS.lib.WordArray): Promise<void> {
    // Encrypt the key with a device-specific key before storing
    const deviceKey = await this.getDeviceKey();
    
    const encryptedKey = CryptoJS.AES.encrypt(key.toString(), deviceKey).toString();
    
    const keyData = {
      key: encryptedKey,
      salt: salt.toString(CryptoJS.enc.Base64),
      timestamp: Date.now()
    };

    // Store in IndexedDB (more secure than localStorage)
    try {
      await this.storeInIndexedDB('encryption_keys', 'master', keyData);
    } catch {
      // Fallback to sessionStorage if IndexedDB fails
      sessionStorage.setItem('wt_master_key', JSON.stringify(keyData));
    }
  }

  /**
   * Get stored key data
   */
  private async getStoredKeyData(): Promise<any> {
    try {
      // Try IndexedDB first
      const record = await this.getFromIndexedDB('encryption_keys', 'master');
      if (record && record.key) {
        return record;
      }
    } catch {
      // Fallback to sessionStorage
      const stored = sessionStorage.getItem('wt_master_key');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.key) {
          return parsed;
        }
      }
    }
    return null;
  }

  /**
   * Decrypt stored key
   */
  private async decryptStoredKey(keyData: any): Promise<CryptoJS.lib.WordArray> {
    const deviceKey = await this.getDeviceKey();
    const decrypted = CryptoJS.AES.decrypt(keyData.key, deviceKey);
    return decrypted;
  }

  /**
   * Get device-specific key for key encryption
   */
  private async getDeviceKey(): Promise<string> {
    const fingerprint = await this.getDeviceFingerprint();
    return CryptoJS.SHA256(`device-key-${fingerprint}`).toString();
  }

  /**
   * Check if key is expired
   */
  private isKeyExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.keyRotationInterval;
  }

  /**
   * Generate secure random values
   */
  generateSecureRandom(bytes: number = 32): string {
    return CryptoJS.lib.WordArray.random(bytes).toString(CryptoJS.enc.Base64);
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Create HMAC for data integrity
   */
  createHMAC(data: string, key?: string): string {
    const hmacKey = key || this.masterKey?.toString() || '';
    return CryptoJS.HmacSHA256(data, hmacKey).toString();
  }

  /**
   * Verify HMAC
   */
  verifyHMAC(data: string, hmac: string, key?: string): boolean {
    const computed = this.createHMAC(data, key);
    return computed === hmac;
  }

  /**
   * Secure compare to prevent timing attacks
   */
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Clear sensitive data from memory
   */
  clearSensitiveData(): void {
    this.masterKey = null;
    // Clear any cached keys
    sessionStorage.removeItem('wt_master_key');
  }

  /**
   * Store data in IndexedDB
   */
  private async storeInIndexedDB(storeName: string, key: string, value: any): Promise<void> {
    const db = await this.openIndexedDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    await store.put({ id: key, ...value });
  }

  /**
   * Get data from IndexedDB
   */
  private async getFromIndexedDB(storeName: string, key: string): Promise<any> {
    const db = await this.openIndexedDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const result = await store.get(key);
    return result;
  }

  /**
   * Open IndexedDB connection
   */
  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WealthTrackerSecurity', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('encryption_keys')) {
          db.createObjectStore('encryption_keys', { keyPath: 'id' });
        }
      };
    });
  }
}

// Export singleton instance
export const enhancedEncryption = new EnhancedEncryptionService();

// Export types
export type { EncryptedData, EncryptionConfig };
