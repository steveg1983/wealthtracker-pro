/**
 * Security Service - Handles application security features
 *
 * Features:
 * - Password strength validation
 * - Two-factor authentication
 * - Session management
 * - Security audit logging
 * - Device management
 */

import { lazyLogger } from './serviceFactory';

const logger = lazyLogger.getLogger('SecurityService');

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  passwordExpiryDays: number;
  maxLoginAttempts: number;
  deviceTrustingEnabled: boolean;
  auditLoggingEnabled: boolean;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  isTrusted: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  os: string;
  browser: string;
  isTrusted: boolean;
  lastSeen: Date;
}

export interface SecurityAuditLog {
  id: string;
  userId: string;
  event: SecurityEvent;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export type SecurityEvent =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'suspicious_activity'
  | 'device_trusted'
  | 'device_revoked'
  | 'session_expired'
  | 'account_locked';

export interface PasswordStrengthResult {
  score: number; // 0-100
  strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  feedback: string[];
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
  };
}

class SecurityService {
  private static instance: SecurityService;

  private constructor() {
    logger.info('SecurityService initialized');
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  // Security Settings Management
  public static async getSecuritySettings(userId: string): Promise<SecuritySettings> {
    logger.info('Getting security settings', { userId });

    try {
      // Mock implementation
      return {
        twoFactorEnabled: false,
        sessionTimeout: 30, // minutes
        passwordExpiryDays: 90,
        maxLoginAttempts: 5,
        deviceTrustingEnabled: true,
        auditLoggingEnabled: true
      };
    } catch (error) {
      logger.error('Error getting security settings:', error);
      throw error;
    }
  }

  public static async updateSecuritySettings(
    userId: string,
    settings: Partial<SecuritySettings>
  ): Promise<SecuritySettings> {
    logger.info('Updating security settings', { userId, settings });

    try {
      // Mock implementation
      const currentSettings = await this.getSecuritySettings(userId);
      const updatedSettings = { ...currentSettings, ...settings };

      await this.logSecurityEvent(userId, 'security_settings_updated', {
        changes: settings
      });

      return updatedSettings;
    } catch (error) {
      logger.error('Error updating security settings:', error);
      throw error;
    }
  }

  // Password Management
  public static validatePasswordStrength(password: string): PasswordStrengthResult {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    const metRequirements = Object.values(requirements).filter(Boolean).length;
    let score = 0;
    let strength: PasswordStrengthResult['strength'] = 'very-weak';
    const feedback: string[] = [];

    // Base score from length
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;

    // Character variety
    if (requirements.uppercase) score += 15;
    if (requirements.lowercase) score += 15;
    if (requirements.numbers) score += 15;
    if (requirements.symbols) score += 15;

    // Penalties
    if (password.length < 8) {
      feedback.push('Use at least 8 characters');
    }
    if (!requirements.uppercase) {
      feedback.push('Include uppercase letters');
    }
    if (!requirements.lowercase) {
      feedback.push('Include lowercase letters');
    }
    if (!requirements.numbers) {
      feedback.push('Include numbers');
    }
    if (!requirements.symbols) {
      feedback.push('Include special characters');
    }

    // Common patterns (simplified)
    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      feedback.push('Avoid repeating characters');
    }
    if (/123|abc|qwerty/i.test(password)) {
      score -= 15;
      feedback.push('Avoid common patterns');
    }

    // Determine strength
    if (score >= 90) strength = 'very-strong';
    else if (score >= 80) strength = 'strong';
    else if (score >= 65) strength = 'good';
    else if (score >= 50) strength = 'fair';
    else if (score >= 30) strength = 'weak';
    else strength = 'very-weak';

    return {
      score: Math.max(0, Math.min(100, score)),
      strength,
      feedback,
      requirements
    };
  }

  // Two-Factor Authentication
  public static async setupTwoFactor(userId: string): Promise<TwoFactorSetup> {
    logger.info('Setting up 2FA', { userId });

    try {
      // Mock implementation
      const secret = this.generateSecret();
      const qrCodeUrl = `otpauth://totp/WealthTracker:${userId}?secret=${secret}&issuer=WealthTracker`;
      const backupCodes = Array.from({ length: 10 }, () => this.generateBackupCode());

      return {
        secret,
        qrCodeUrl,
        backupCodes
      };
    } catch (error) {
      logger.error('Error setting up 2FA:', error);
      throw error;
    }
  }

  public static async enableTwoFactor(userId: string, token: string): Promise<boolean> {
    logger.info('Enabling 2FA', { userId });

    try {
      // Mock validation
      const isValidToken = token.length === 6 && /^\d+$/.test(token);

      if (isValidToken) {
        await this.logSecurityEvent(userId, '2fa_enabled', {});
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      throw error;
    }
  }

  public static async disableTwoFactor(userId: string): Promise<void> {
    logger.info('Disabling 2FA', { userId });

    try {
      await this.logSecurityEvent(userId, '2fa_disabled', {});
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw error;
    }
  }

  public static async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    try {
      // Mock validation
      return token.length === 6 && /^\d+$/.test(token);
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      throw error;
    }
  }

  // Session Management
  public static async getUserSessions(userId: string): Promise<UserSession[]> {
    logger.info('Getting user sessions', { userId });

    try {
      // Mock implementation
      return [
        {
          id: 'session-1',
          userId,
          deviceInfo: {
            id: 'device-1',
            name: 'Chrome on MacBook Pro',
            type: 'desktop',
            os: 'macOS',
            browser: 'Chrome',
            isTrusted: true,
            lastSeen: new Date()
          },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: true,
          isTrusted: true
        }
      ];
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      throw error;
    }
  }

  public static async revokeSession(userId: string, sessionId: string): Promise<void> {
    logger.info('Revoking session', { userId, sessionId });

    try {
      await this.logSecurityEvent(userId, 'session_revoked', { sessionId });
    } catch (error) {
      logger.error('Error revoking session:', error);
      throw error;
    }
  }

  public static async revokeAllSessions(userId: string, keepCurrent = true): Promise<void> {
    logger.info('Revoking all sessions', { userId, keepCurrent });

    try {
      await this.logSecurityEvent(userId, 'all_sessions_revoked', { keepCurrent });
    } catch (error) {
      logger.error('Error revoking all sessions:', error);
      throw error;
    }
  }

  // Device Management
  public static async getTrustedDevices(userId: string): Promise<DeviceInfo[]> {
    logger.info('Getting trusted devices', { userId });

    try {
      // Mock implementation
      return [
        {
          id: 'device-1',
          name: 'MacBook Pro',
          type: 'desktop',
          os: 'macOS',
          browser: 'Chrome',
          isTrusted: true,
          lastSeen: new Date()
        }
      ];
    } catch (error) {
      logger.error('Error getting trusted devices:', error);
      throw error;
    }
  }

  public static async trustDevice(userId: string, deviceId: string): Promise<void> {
    logger.info('Trusting device', { userId, deviceId });

    try {
      await this.logSecurityEvent(userId, 'device_trusted', { deviceId });
    } catch (error) {
      logger.error('Error trusting device:', error);
      throw error;
    }
  }

  public static async revokeDevice(userId: string, deviceId: string): Promise<void> {
    logger.info('Revoking device', { userId, deviceId });

    try {
      await this.logSecurityEvent(userId, 'device_revoked', { deviceId });
    } catch (error) {
      logger.error('Error revoking device:', error);
      throw error;
    }
  }

  // Security Audit
  public static async getSecurityAuditLog(
    userId: string,
    limit = 100,
    offset = 0
  ): Promise<SecurityAuditLog[]> {
    logger.info('Getting security audit log', { userId, limit, offset });

    try {
      // Mock implementation
      return [
        {
          id: 'audit-1',
          userId,
          event: 'login_success',
          details: { ipAddress: '192.168.1.100' },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          timestamp: new Date(),
          severity: 'low'
        }
      ];
    } catch (error) {
      logger.error('Error getting security audit log:', error);
      throw error;
    }
  }

  public static async logSecurityEvent(
    userId: string,
    event: SecurityEvent,
    details: Record<string, any> = {}
  ): Promise<void> {
    logger.info('Logging security event', { userId, event, details });

    try {
      // Mock implementation - in real app, this would write to audit log
      const auditEntry: SecurityAuditLog = {
        id: `audit-${Date.now()}`,
        userId,
        event,
        details,
        ipAddress: '0.0.0.0', // Would get from request
        userAgent: 'Unknown', // Would get from request
        timestamp: new Date(),
        severity: this.getEventSeverity(event)
      };

      // Mock storage
      logger.debug('Audit entry created', auditEntry);
    } catch (error) {
      logger.error('Error logging security event:', error);
      throw error;
    }
  }

  // Utility Methods
  private static generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private static generateBackupCode(): string {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  private static getEventSeverity(event: SecurityEvent): 'low' | 'medium' | 'high' | 'critical' {
    switch (event) {
      case 'login_success':
      case 'logout':
        return 'low';
      case 'login_failed':
      case 'device_trusted':
      case 'device_revoked':
        return 'medium';
      case 'password_change':
      case '2fa_enabled':
      case '2fa_disabled':
      case 'suspicious_activity':
        return 'high';
      case 'account_locked':
        return 'critical';
      default:
        return 'medium';
    }
  }
}

export default SecurityService;
// Auto-generated export for compatibility
export const securityService = {};
