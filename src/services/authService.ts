/**
 * Authentication Service - Best-in-class auth for #1 finance app
 * 
 * Features:
 * - Passwordless authentication (magic links)
 * - Passkey/WebAuthn support for instant login
 * - Biometric authentication ready for mobile
 * - Multi-factor authentication
 * - Session management
 */

import type { UserResource as User } from '@clerk/types';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  imageUrl?: string;
  createdAt: Date;
  lastSignIn: Date;
  emailVerified: boolean;
  hasPasskey: boolean;
  hasMFA: boolean;
}

export class AuthService {
  /**
   * Convert Clerk user to our app user format
   */
  static mapClerkUser(clerkUser: User): AuthUser {
    // Helper to safely convert Clerk date (Date | number | null) to Date
    const toDate = (value: Date | number | null | undefined): Date => {
      if (value instanceof Date) return value;
      if (typeof value === 'number') return new Date(value);
      return new Date();
    };

    // Check for passkey support - use 'in' operator for type-safe property access
    const hasPasskey = 'passkeys' in clerkUser &&
      Array.isArray(clerkUser.passkeys) &&
      clerkUser.passkeys.length > 0;

    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      name: clerkUser.fullName || undefined,
      imageUrl: clerkUser.imageUrl,
      createdAt: toDate(clerkUser.createdAt),
      lastSignIn: toDate(clerkUser.lastSignInAt ?? clerkUser.createdAt),
      emailVerified: clerkUser.primaryEmailAddress?.verification?.status === 'verified',
      hasPasskey,
      hasMFA: clerkUser.totpEnabled || clerkUser.backupCodeEnabled || clerkUser.twoFactorEnabled
    };
  }

  /**
   * Check if user has premium security features enabled
   */
  static hasEnhancedSecurity(user: AuthUser): boolean {
    return user.hasPasskey || user.hasMFA;
  }

  /**
   * Get security score for user (0-100)
   */
  static getSecurityScore(user: AuthUser): number {
    let score = 0;
    
    // Basic email verification: 30 points
    if (user.emailVerified) score += 30;
    
    // Passkey usage: 40 points (most secure)
    if (user.hasPasskey) score += 40;
    
    // MFA enabled: 30 points
    if (user.hasMFA) score += 30;
    
    return score;
  }

  /**
   * Get security recommendations for user
   */
  static getSecurityRecommendations(user: AuthUser): string[] {
    const recommendations: string[] = [];
    
    if (!user.emailVerified) {
      recommendations.push('Verify your email address for better account recovery');
    }
    
    if (!user.hasPasskey) {
      recommendations.push('Enable passkey login for instant, secure access');
    }
    
    if (!user.hasMFA) {
      recommendations.push('Add an authenticator app for extra security');
    }
    
    return recommendations;
  }

  /**
   * Format last sign in for display
   */
  static formatLastSignIn(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }
}

// Auth configuration for different environments
export const authConfig = {
  // Production settings
  production: {
    allowedRedirectUrls: ['https://wealthtracker.app/*'],
    sessionTimeout: 60 * 60 * 1000, // 1 hour
    requireEmailVerification: true,
    requireMFA: false, // Optional but recommended
  },
  
  // Development settings
  development: {
    allowedRedirectUrls: ['http://localhost:*/*'],
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours for dev
    requireEmailVerification: false,
    requireMFA: false,
  }
};

// Get current environment config
export const currentAuthConfig = process.env.NODE_ENV === 'production' 
  ? authConfig.production 
  : authConfig.development;
