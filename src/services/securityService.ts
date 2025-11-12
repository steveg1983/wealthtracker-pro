import type { AuditLogChanges, SavedAuditLog } from '../types/security';
import type { JsonValue } from '../types/common';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type CredentialsContainerLike = Pick<CredentialsContainer, 'create' | 'get'>;

interface NavigatorLike {
  userAgent?: string;
  credentials?: CredentialsContainerLike | null;
}

interface LocationLike {
  hostname: string;
}

interface CryptoLike {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
  subtle: SubtleCrypto;
}

type PublicKeyCredentialLike = Pick<typeof PublicKeyCredential, 'isUserVerifyingPlatformAuthenticatorAvailable'>;

type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

export interface SecurityServiceOptions {
  storage?: StorageLike | null;
  navigator?: NavigatorLike | null;
  credentials?: CredentialsContainerLike | null;
  publicKeyCredential?: PublicKeyCredentialLike | null;
  location?: LocationLike | null;
  crypto?: CryptoLike | null;
  now?: () => number;
  logger?: Logger;
}

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

export class SecurityService {
  private settings: SecuritySettings;
  private auditLogs: AuditLog[] = [];
  private storage: StorageLike | null;
  private navigatorRef: NavigatorLike | null;
  private credentials: CredentialsContainerLike | null;
  private publicKeyCredential: PublicKeyCredentialLike | null;
  private locationRef: LocationLike | null;
  private cryptoRef: CryptoLike | null;
  private nowProvider: () => number;
  private logger: Logger;

  constructor(options: SecurityServiceOptions = {}) {
    this.storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    this.navigatorRef = options.navigator ?? (typeof navigator !== 'undefined' ? navigator : null);
    this.credentials = options.credentials ?? this.navigatorRef?.credentials ?? null;
    this.publicKeyCredential = options.publicKeyCredential ?? (typeof PublicKeyCredential !== 'undefined' ? PublicKeyCredential : null);
    this.locationRef = options.location ?? (typeof window !== 'undefined' ? window.location : null);
    this.cryptoRef = options.crypto ?? (typeof crypto !== 'undefined' ? crypto : null);
    this.nowProvider = options.now ?? (() => Date.now());
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      log: options.logger?.log ?? (fallbackLogger?.log?.bind(fallbackLogger) ?? noop),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };

    this.settings = this.loadSettings();
    this.auditLogs = this.loadAuditLogs();
  }

  // Settings Management
  private loadSettings(): SecuritySettings {
    if (!this.storage) {
      return this.getDefaultSettings();
    }

    const stored = this.storage.getItem(SECURITY_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SecuritySettings;
      if (parsed.lastLogin) {
        parsed.lastLogin = new Date(parsed.lastLogin);
      }
      if (parsed.lockedUntil) {
        parsed.lockedUntil = new Date(parsed.lockedUntil);
      }
      return parsed;
    }

    return this.getDefaultSettings();
  }

  private getDefaultSettings(): SecuritySettings {
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
    if (!this.storage) {
      return;
    }
    this.storage.setItem(SECURITY_SETTINGS_KEY, JSON.stringify(this.settings));
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
    const time = Math.floor(this.nowProvider() / 30000);
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
    if (!(await this.isBiometricAvailable())) {
      throw new Error('Biometric authentication not available');
    }

    if (!this.credentials?.create) {
      throw new Error('Credentials API not available');
    }

    if (!this.cryptoRef) {
      throw new Error('Crypto API not available');
    }

    try {
      const challenge = new Uint8Array(32);
      this.cryptoRef.getRandomValues(challenge);

      const createOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'Wealth Tracker',
            id: this.locationRef?.hostname ?? 'localhost'
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

      const credential = await this.credentials.create(createOptions) as PublicKeyCredential | null;
      
      if (credential) {
        const biometricCredential: BiometricCredential = {
          credentialId: this.arrayBufferToBase64(credential.rawId),
          publicKey: 'mock-public-key',
          counter: 0,
          createdAt: new Date(this.nowProvider())
        };

        this.saveBiometricCredential(biometricCredential);
        return biometricCredential;
      }
    } catch (error) {
      this.logger.error('Biometric setup failed:', error);
    }

    return null;
  }

  async verifyBiometric(): Promise<boolean> {
    if (!(await this.isBiometricAvailable())) {
      return false;
    }

    if (!this.credentials?.get || !this.cryptoRef) {
      return false;
    }

    try {
      const credentials = this.loadBiometricCredentials();
      if (credentials.length === 0) {
        return false;
      }

      const challenge = new Uint8Array(32);
      this.cryptoRef.getRandomValues(challenge);

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

      const assertion = await this.credentials.get(getOptions);
      return assertion !== null;
    } catch (error) {
      this.logger.error('Biometric verification failed:', error);
      return false;
    }
  }

  async isBiometricAvailable(): Promise<boolean> {
    if (!this.publicKeyCredential) {
      return false;
    }

    const availabilityChecker = this.publicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
    if (typeof availabilityChecker === 'function') {
      try {
        return await availabilityChecker();
      } catch {
        return false;
      }
    }

    return false;
  }

  private saveBiometricCredential(credential: BiometricCredential) {
    const credentials = this.loadBiometricCredentials();
    credentials.push(credential);
    this.storage?.setItem(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(credentials));
  }

  private loadBiometricCredentials(): BiometricCredential[] {
    if (!this.storage) {
      return [];
    }
    const stored = this.storage.getItem(BIOMETRIC_CREDENTIALS_KEY);
    if (!stored) {
      return [];
    }

    return JSON.parse(stored).map((cred: BiometricCredential) => ({
      ...cred,
      createdAt: cred.createdAt ? new Date(cred.createdAt) : new Date(this.nowProvider())
    }));
  }

  // Encryption
  async encryptData(data: string): Promise<string> {
    if (!this.settings.encryptionEnabled) {
      return data;
    }

    if (!this.cryptoRef?.subtle) {
      this.logger.warn('Encryption requested but crypto API unavailable. Returning plaintext.');
      return data;
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Generate key
      const key = await this.getEncryptionKey();
      
      // Generate IV
      const iv = this.cryptoRef.getRandomValues(new Uint8Array(12));
      
      // Encrypt
      const encryptedBuffer = await this.cryptoRef.subtle.encrypt(
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
      this.logger.error('Encryption failed:', error);
      return data;
    }
  }

  async decryptData(encryptedData: string): Promise<string> {
    if (!this.settings.encryptionEnabled) {
      return encryptedData;
    }

    if (!this.cryptoRef?.subtle) {
      this.logger.warn('Decryption requested but crypto API unavailable. Returning input.');
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
      const decryptedBuffer = await this.cryptoRef.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      return encryptedData;
    }
  }

  private async getEncryptionKey(): Promise<CryptoKey> {
    if (!this.cryptoRef?.subtle) {
      throw new Error('Crypto API unavailable');
    }

    // In production, derive key from user password or use key management service
    const keyMaterial = await this.cryptoRef.subtle.importKey(
      'raw',
      new TextEncoder().encode('temporary-encryption-key-32bytes'),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    return this.cryptoRef.subtle.deriveKey(
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
    if (!this.storage) {
      return [];
    }
    const stored = this.storage.getItem(AUDIT_LOGS_KEY);
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
    this.storage?.setItem(AUDIT_LOGS_KEY, JSON.stringify(logsToSave));
  }

  logAction(
    action: AuditLog['action'],
    resourceType: AuditLog['resourceType'],
    resourceId?: string,
    changes?: AuditLogChanges
  ) {
    const log: AuditLog = {
      id: this.generateRandomString(16),
      timestamp: new Date(this.nowProvider()),
      userId: 'current-user',
      action,
      resourceType,
      resourceId,
      changes,
      ipAddress: 'localhost',
      userAgent: this.navigatorRef?.userAgent ?? 'unknown'
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
    
    const sessionDuration = this.nowProvider() - this.settings.lastLogin.getTime();
    const timeoutMs = this.settings.sessionTimeout * 60 * 1000;
    
    return sessionDuration < timeoutMs;
  }

  updateLastActivity() {
    this.settings.lastLogin = new Date(this.nowProvider());
    this.saveSettings();
  }

  // Account Lockout
  recordFailedAttempt() {
    this.settings.failedAttempts++;
    
    if (this.settings.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      this.settings.lockedUntil = new Date(this.nowProvider() + LOCKOUT_DURATION);
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
    
    if (this.nowProvider() > this.settings.lockedUntil.getTime()) {
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
    if (this.cryptoRef?.getRandomValues) {
      this.cryptoRef.getRandomValues(randomValues);
    } else {
      for (let i = 0; i < length; i++) {
        randomValues[i] = Math.floor(Math.random() * chars.length);
      }
    }
    
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    
    return result;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    if (typeof btoa === 'function') {
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    const nodeBuffer = (globalThis as { Buffer?: { from: (input: ArrayBuffer | Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
    if (nodeBuffer) {
      return nodeBuffer.from(bytes).toString('base64');
    }

    throw new Error('Base64 encoding not supported in this environment');
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    if (typeof atob === 'function') {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }

    const nodeBuffer = (globalThis as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
    if (nodeBuffer) {
      const buffer = nodeBuffer.from(base64, 'base64');
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }

    throw new Error('Base64 decoding not supported in this environment');
  }
}

export const securityService = new SecurityService();
