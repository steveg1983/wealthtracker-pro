/**
 * Encryption Tests
 * Verifies encryption functionality and security
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CryptoJS from 'crypto-js';

// Import after CryptoJS is available
const getEnhancedEncryption = async () => {
  const module = await import('../encryption-enhanced');
  return module.enhancedEncryption;
};

describe('Enhanced Encryption Service', () => {
  let enhancedEncryption: any;

  beforeEach(async () => {
    // Clear any stored keys
    sessionStorage.clear();
    
    // Get the service
    enhancedEncryption = await getEnhancedEncryption();
    
    // Initialize the service
    await enhancedEncryption.initialize();
  });

  afterEach(() => {
    // Clean up
    if (enhancedEncryption) {
      enhancedEncryption.clearSensitiveData();
    }
  });

  describe('Encryption and Decryption', () => {
    it('encrypts and decrypts string data', async () => {
      const testData = 'Sensitive financial information';
      
      const encrypted = enhancedEncryption.encrypt(testData);
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('timestamp');
      expect(encrypted.algorithm).toBe('AES');
      
      const decrypted = enhancedEncryption.decrypt<string>(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('encrypts and decrypts object data', async () => {
      const testData = {
        accountNumber: '1234567890',
        balance: 1000.50,
        transactions: [
          { id: 1, amount: 50 },
          { id: 2, amount: -25.99 }
        ]
      };
      
      const encrypted = enhancedEncryption.encrypt(testData);
      const decrypted = enhancedEncryption.decrypt<typeof testData>(encrypted);
      
      expect(decrypted).toEqual(testData);
      expect(decrypted.accountNumber).toBe(testData.accountNumber);
      expect(decrypted.balance).toBe(testData.balance);
      expect(decrypted.transactions).toHaveLength(2);
    });

    it('encrypts and decrypts array data', async () => {
      const testData = ['account1', 'account2', 'account3'];
      
      const encrypted = enhancedEncryption.encrypt(testData);
      const decrypted = enhancedEncryption.decrypt<string[]>(encrypted);
      
      expect(decrypted).toEqual(testData);
    });

    it('produces different ciphertext for same data', async () => {
      const testData = 'Same data encrypted twice';
      
      const encrypted1 = enhancedEncryption.encrypt(testData);
      const encrypted2 = enhancedEncryption.encrypt(testData);
      
      // Different salts and IVs should produce different ciphertexts
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      
      // But both should decrypt to the same value
      expect(enhancedEncryption.decrypt(encrypted1)).toBe(testData);
      expect(enhancedEncryption.decrypt(encrypted2)).toBe(testData);
    });

    it('fails to decrypt with tampered data', async () => {
      const testData = 'Original data';
      const encrypted = enhancedEncryption.encrypt(testData);
      
      // Tamper with the ciphertext
      encrypted.ciphertext = 'tampered-ciphertext';
      
      expect(() => enhancedEncryption.decrypt(encrypted)).toThrow();
    });

    it('handles null and undefined values', async () => {
      const encrypted1 = enhancedEncryption.encrypt(null);
      const encrypted2 = enhancedEncryption.encrypt(undefined);
      
      expect(enhancedEncryption.decrypt(encrypted1)).toBeNull();
      expect(enhancedEncryption.decrypt(encrypted2)).toBeUndefined();
    });
  });

  describe('Security Functions', () => {
    it('generates secure random values', () => {
      const random1 = enhancedEncryption.generateSecureRandom();
      const random2 = enhancedEncryption.generateSecureRandom();
      
      expect(random1).toBeTruthy();
      expect(random2).toBeTruthy();
      expect(random1).not.toBe(random2);
    });

    it('creates consistent hashes', () => {
      const data = 'Hash this data';
      
      const hash1 = enhancedEncryption.hash(data);
      const hash2 = enhancedEncryption.hash(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produces 64 character hex string
    });

    it('creates and verifies HMAC', () => {
      const data = 'Data to authenticate';
      const key = 'secret-key';
      
      const hmac = enhancedEncryption.createHMAC(data, key);
      expect(hmac).toBeTruthy();
      
      // Verify with correct data and key
      expect(enhancedEncryption.verifyHMAC(data, hmac, key)).toBe(true);
      
      // Fail with tampered data
      expect(enhancedEncryption.verifyHMAC(data + 'tampered', hmac, key)).toBe(false);
      
      // Fail with wrong key
      expect(enhancedEncryption.verifyHMAC(data, hmac, 'wrong-key')).toBe(false);
    });

    it('performs secure comparison', () => {
      const value1 = 'secret-value';
      const value2 = 'secret-value';
      const value3 = 'different-value';
      
      expect(enhancedEncryption.secureCompare(value1, value2)).toBe(true);
      expect(enhancedEncryption.secureCompare(value1, value3)).toBe(false);
      expect(enhancedEncryption.secureCompare('', '')).toBe(true);
      expect(enhancedEncryption.secureCompare('a', 'ab')).toBe(false);
    });
  });

  describe('Key Management', () => {
    it('initializes without user identifier', async () => {
      // Already initialized in beforeEach
      const testData = 'Test encryption after init';
      const encrypted = enhancedEncryption.encrypt(testData);
      const decrypted = enhancedEncryption.decrypt<string>(encrypted);
      
      expect(decrypted).toBe(testData);
    });

    it('clears sensitive data', async () => {
      const testData = 'Data before clear';
      const encrypted = enhancedEncryption.encrypt(testData);
      
      enhancedEncryption.clearSensitiveData();
      
      // Should throw after clearing keys
      expect(() => enhancedEncryption.encrypt('New data')).toThrow('Encryption service not initialized');
    });
  });

  describe('Error Handling', () => {
    it('throws error when not initialized', () => {
      enhancedEncryption.clearSensitiveData();
      
      expect(() => enhancedEncryption.encrypt('data')).toThrow('Encryption service not initialized');
    });

    it('handles invalid encrypted data gracefully', () => {
      const invalidData = {
        ciphertext: 'invalid',
        salt: 'invalid',
        iv: 'invalid',
        algorithm: 'AES',
        timestamp: Date.now()
      };
      
      expect(() => enhancedEncryption.decrypt(invalidData)).toThrow();
    });
  });

  describe('Performance', () => {
    it('encrypts large data efficiently', async () => {
      // Create a large object
      const largeData = {
        accounts: Array(100).fill(null).map((_, i) => ({
          id: i,
          name: `Account ${i}`,
          balance: Math.random() * 10000,
          transactions: Array(10).fill(null).map((_, j) => ({
            id: j,
            amount: Math.random() * 100,
            description: `Transaction ${j}`
          }))
        }))
      };
      
      const startTime = performance.now();
      const encrypted = enhancedEncryption.encrypt(largeData);
      const encryptTime = performance.now() - startTime;
      
      const decryptStart = performance.now();
      const decrypted = enhancedEncryption.decrypt(encrypted);
      const decryptTime = performance.now() - decryptStart;
      
      expect(decrypted).toEqual(largeData);
      // Should complete in reasonable time (< 100ms for this size)
      expect(encryptTime).toBeLessThan(100);
      expect(decryptTime).toBeLessThan(100);
    });
  });
});