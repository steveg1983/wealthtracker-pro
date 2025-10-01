/**
 * Security Module
 * Central export for all security features
 */

import {
  setupCSPReporting,
  applyCSPMetaTag,
  getSecurityHeaders
} from './csp';

import {
  setupCSRFForForms,
  setupDoubleSubmitCookie,
  useCSRFToken
} from './csrf-protection';

import {
  sanitizeHTML,
  sanitizeMarkdown,
  sanitizeURL,
  useSanitizedInput
} from './xss-protection';

import {
  initializeRateLimiter as bootstrapRateLimiter,
  rateLimiters,
  useRateLimiter,
  createRateLimitMiddleware,
  RateLimit,
  getRateLimitStatus
} from './rate-limiting';

export {
  setupCSPReporting,
  applyCSPMetaTag,
  getSecurityHeaders,
  setupCSRFForForms,
  setupDoubleSubmitCookie,
  useCSRFToken,
  sanitizeHTML,
  sanitizeMarkdown,
  sanitizeURL,
  useSanitizedInput,
  rateLimiters,
  bootstrapRateLimiter as initializeRateLimiter,
  useRateLimiter,
  createRateLimitMiddleware,
  RateLimit,
  getRateLimitStatus
};

// Initialize all security features
export const initializeSecurity = () => {
  if (typeof window === 'undefined') {
    return;
  }

  setupCSPReporting();

  // Apply CSP meta tag for additional client-side protection
  // @ts-ignore - Safari might not support import.meta.env
  const isProduction = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'production';
  if (isProduction) {
    applyCSPMetaTag();
  }

  setupCSRFForForms();
  setupDoubleSubmitCookie();
  bootstrapRateLimiter();
};

// Security utilities
export const securityUtils = {
  /**
   * Check if the current environment is secure (HTTPS)
   */
  isSecureContext: () => {
    if (typeof window === 'undefined') return true;
    return window.isSecureContext || window.location.protocol === 'https:';
  },

  /**
   * Generate a cryptographically secure random string
   */
  generateSecureRandom: (length: number = 32): string => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Hash sensitive data (e.g., for logging)
   */
  hashSensitiveData: async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Validate origin for CORS
   */
  isAllowedOrigin: (origin: string, allowedOrigins: string[]): boolean => {
    return allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      if (allowed === origin) return true;
      
      // Support wildcard subdomains (*.example.com)
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        return origin.endsWith(domain);
      }
      
      return false;
    });
  }
};

// Security components
export { SafeHTML } from '../components/security/SafeHTML';
