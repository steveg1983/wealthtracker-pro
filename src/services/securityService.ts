import type { AuditLogChanges, SavedAuditLog } from '../types/security';
import type { JsonValue } from '../types/common';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface NavigatorLike {
  userAgent?: string;
}

interface CryptoLike {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
}

type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

export interface SecurityServiceOptions {
  storage?: StorageLike | null;
  navigator?: NavigatorLike | null;
  crypto?: CryptoLike | null;
  now?: () => number;
  logger?: Logger;
}

export interface SecuritySettings {
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

const SECURITY_SETTINGS_KEY = 'security_settings';
const AUDIT_LOGS_KEY = 'audit_logs';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

export class SecurityService {
  private settings: SecuritySettings;
  private auditLogs: AuditLog[] = [];
  private storage: StorageLike | null;
  private navigatorRef: NavigatorLike | null;
  private cryptoRef: CryptoLike | null;
  private nowProvider: () => number;
  private logger: Logger;

  constructor(options: SecurityServiceOptions = {}) {
    this.storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    this.navigatorRef = options.navigator ?? (typeof navigator !== 'undefined' ? navigator : null);
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
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    }

    throw new Error('Base64 decoding not supported in this environment');
  }
}

export const securityService = new SecurityService();
