import { Transaction, Account, Budget, Goal, Investment } from '../types';
import type { AuditLogChanges, SavedAuditLog, BiometricAvailabilityResult } from '../types/security';
import type { JsonValue } from '../types/common';
import { logger } from './loggingService';

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  readOnlyMode: boolean;
  encryptionEnabled: boolean;
  sessionTimeout: number; // minutes
  lastLogin?: Date;
  failedAttempts: number;
  lockedUntil?: Date;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'import';
  resourceType: 'transaction' | 'account' | 'budget' | 'goal' | 'investment' | 'settings';
  resourceId?: string;
  changes?: AuditLogChanges;
  ipAddress?: string;
  userAgent?: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface BiometricCredential {
  credentialId: string;
  publicKey: string;
  counter: number;
  createdAt: Date;
}

const SECURITY_SETTINGS_KEY = 'security_settings';
const AUDIT_LOGS_KEY = 'audit_logs';
const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

class SecurityService {
  private settings: SecuritySettings;
  private auditLogs: AuditLog[] = [];

  constructor() {
    this.settings = this.loadSettings();
    this.auditLogs = this.loadAuditLogs();
  }

  // Settings Management
  private loadSettings(): SecuritySettings {
    const stored = localStorage.getItem(SECURITY_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      twoFactorEnabled: false,
      biometricEnabled: false,
      readOnlyMode: false,
      encryptionEnabled: false,
      sessionTimeout: 30,
      failedAttempts: 0
    };
  }

  private saveSettings() {
    localStorage.setItem(SECURITY_SETTINGS_KEY, JSON.stringify(this.settings));
  }

  getSecuritySettings(): SecuritySettings {
    return { ...this.settings };
  }

  updateSecuritySettings(settings: Partial<SecuritySettings>) {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...settings };
    this.saveSettings();
    
    // Create audit log changes in the correct format
    const changes: AuditLogChanges = {};
    Object.keys(settings).forEach(key => {
      if (key in settings) {
        changes[key] = {
          old: oldSettings[key as keyof SecuritySettings] as JsonValue,
          new: settings[key as keyof SecuritySettings] as JsonValue
        };
      }
    });
    
    this.logAction('update', 'settings', 'security', changes);
  }

  // Two-Factor Authentication
  generateTwoFactorSecret(): TwoFactorSetup {
    // Generate random secret
    const secret = this.generateRandomString(32);
    
    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      this.generateRandomString(8).toUpperCase()
    );
    
    // Generate QR code URL (in production, use actual TOTP library)
    const appName = 'WealthTracker';
    const userName = 'user@example.com';
    const qrCode = `otpauth://totp/${appName}:${userName}?secret=${secret}&issuer=${appName}`;
    
    return { secret, qrCode, backupCodes };
  }

  verifyTwoFactorCode(code: string, secret: string): boolean {
    // In production, use proper TOTP verification
    // This is a mock implementation
    const expectedCode = this.generateTOTPCode(secret);
    return code === expectedCode;
  }

  private generateTOTPCode(secret: string): string {
    // Mock TOTP code generation
    const time = Math.floor(Date.now() / 30000);
    return String(Math.abs(this.hashCode(secret + time)) % 1000000).padStart(6, '0');
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  // Biometric Authentication
  async setupBiometric(): Promise<BiometricCredential | null> {
    if (!this.isBiometricAvailable()) {
      throw new Error('Biometric authentication not available');
    }

    try {
      // Check if WebAuthn is available
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn not supported');
      }

      // Create credential options
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const createOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'Wealth Tracker',
            id: window.location.hostname
          },
          user: {
            id: new TextEncoder().encode('user-id'),
            name: 'user@example.com',
            displayName: 'User'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000,
          attestation: 'direct'
        }
      };

      // Create credential
      const credential = await navigator.credentials.create(createOptions) as PublicKeyCredential;
      
      if (credential) {
        const biometricCredential: BiometricCredential = {
          credentialId: this.arrayBufferToBase64(credential.rawId),
          publicKey: 'mock-public-key',
          counter: 0,
          createdAt: new Date()
        };

        // Save credential
        this.saveBiometricCredential(biometricCredential);
        return biometricCredential;
      }
    } catch (error) {
      logger.error('Biometric setup failed:', error);
    }

    return null;
  }

  async verifyBiometric(): Promise<boolean> {
    if (!this.isBiometricAvailable()) {
      return false;
    }

    try {
      const credentials = this.loadBiometricCredentials();
      if (credentials.length === 0) {
        return false;
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const getOptions: CredentialRequestOptions = {
        publicKey: {
          challenge,
          allowCredentials: credentials.map(cred => ({
            id: this.base64ToArrayBuffer(cred.credentialId),
            type: 'public-key' as PublicKeyCredentialType
          })),
          userVerification: 'required',
          timeout: 60000
        }
      };

      const assertion = await navigator.credentials.get(getOptions);
      return assertion !== null;
    } catch (error) {
      logger.error('Biometric verification failed:', error);
      return false;
    }
  }

  async isBiometricAvailable(): Promise<boolean> {
    // Check for WebAuthn support
    if (!window.PublicKeyCredential) {
      return false;
    }

    // Check for platform authenticator (Touch ID, Face ID, Windows Hello)
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        return false;
      }
    }
    
    return false;
  }

  private saveBiometricCredential(credential: BiometricCredential) {
    const credentials = this.loadBiometricCredentials();
    credentials.push(credential);
    localStorage.setItem(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(credentials));
  }

  private loadBiometricCredentials(): BiometricCredential[] {
    const stored = localStorage.getItem(BIOMETRIC_CREDENTIALS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  // Encryption
  async encryptData(data: string): Promise<string> {
    if (!this.settings.encryptionEnabled) {
      return data;
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Generate key
      const key = await this.getEncryptionKey();
      
      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBuffer
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);
      
      return this.arrayBufferToBase64(combined.buffer);
    } catch (error) {
      logger.error('Encryption failed:', error);
      return data;
    }
  }

  async decryptData(encryptedData: string): Promise<string> {
    if (!this.settings.encryptionEnabled) {
      return encryptedData;
    }

    try {
      const combined = this.base64ToArrayBuffer(encryptedData);
      const combinedArray = new Uint8Array(combined);
      
      // Extract IV and encrypted data
      const iv = combinedArray.slice(0, 12);
      const encrypted = combinedArray.slice(12);
      
      // Get key
      const key = await this.getEncryptionKey();
      
      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      logger.error('Decryption failed:', error);
      return encryptedData;
    }
  }

  private async getEncryptionKey(): Promise<CryptoKey> {
    // In production, derive key from user password or use key management service
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('temporary-encryption-key-32bytes'),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('wealth-tracker-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Read-Only Mode
  isReadOnlyMode(): boolean {
    return this.settings.readOnlyMode;
  }

  toggleReadOnlyMode(enabled: boolean) {
    const oldValue = this.settings.readOnlyMode;
    this.settings.readOnlyMode = enabled;
    this.saveSettings();
    
    const changes: AuditLogChanges = {
      readOnlyMode: {
        old: oldValue as JsonValue,
        new: enabled as JsonValue
      }
    };
    
    this.logAction('update', 'settings', 'read-only-mode', changes);
  }

  // Audit Logging
  private loadAuditLogs(): AuditLog[] {
    const stored = localStorage.getItem(AUDIT_LOGS_KEY);
    if (stored) {
      const logs = JSON.parse(stored);
      // Convert date strings back to Date objects
      return logs.map((log: SavedAuditLog) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
    }
    return [];
  }

  private saveAuditLogs() {
    // Keep only last 1000 logs
    const logsToSave = this.auditLogs.slice(-1000);
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logsToSave));
  }

  logAction(
    action: AuditLog['action'],
    resourceType: AuditLog['resourceType'],
    resourceId?: string,
    changes?: AuditLogChanges
  ) {
    const log: AuditLog = {
      id: this.generateRandomString(16),
      timestamp: new Date(),
      userId: 'current-user',
      action,
      resourceType,
      resourceId,
      changes,
      ipAddress: 'localhost',
      userAgent: navigator.userAgent
    };
    
    this.auditLogs.push(log);
    this.saveAuditLogs();
  }

  getAuditLogs(filters?: {
    startDate?: Date;
    endDate?: Date;
    action?: AuditLog['action'];
    resourceType?: AuditLog['resourceType'];
  }): AuditLog[] {
    let logs = [...this.auditLogs];
    
    if (filters) {
      if (filters.startDate) {
        logs = logs.filter(log => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        logs = logs.filter(log => log.timestamp <= filters.endDate!);
      }
      if (filters.action) {
        logs = logs.filter(log => log.action === filters.action);
      }
      if (filters.resourceType) {
        logs = logs.filter(log => log.resourceType === filters.resourceType);
      }
    }
    
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Session Management
  checkSession(): boolean {
    if (!this.settings.lastLogin) {
      return false;
    }
    
    const sessionDuration = Date.now() - this.settings.lastLogin.getTime();
    const timeoutMs = this.settings.sessionTimeout * 60 * 1000;
    
    return sessionDuration < timeoutMs;
  }

  updateLastActivity() {
    this.settings.lastLogin = new Date();
    this.saveSettings();
  }

  // Account Lockout
  recordFailedAttempt() {
    this.settings.failedAttempts++;
    
    if (this.settings.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      this.settings.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
    }
    
    this.saveSettings();
  }

  resetFailedAttempts() {
    this.settings.failedAttempts = 0;
    this.settings.lockedUntil = undefined;
    this.saveSettings();
  }

  isAccountLocked(): boolean {
    if (!this.settings.lockedUntil) {
      return false;
    }
    
    if (new Date() > this.settings.lockedUntil) {
      this.resetFailedAttempts();
      return false;
    }
    
    return true;
  }

  // Utility methods
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    
    return result;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const securityService = new SecurityService();