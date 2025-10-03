/**
 * Security Module
 * Central export for all security features
 */

// Named exports for better tree-shaking
// CSP (Content Security Policy)
export { 
  getSecurityHeaders,
  setupCSPReporting,
  applyCSPMetaTag,
  getCSPDirectives,
  reportCSPViolation
} from './csp';

// XSS Protection
export {
  sanitizeHTML,
  sanitizeText,
  sanitizeURL,
  sanitizeNumber,
  sanitizeArray,
  sanitizeObject,
  createDOMPurifyInstance,
  useSanitizedInput
} from './xss-protection';

// CSRF Protection  
export {
  generateCSRFToken,
  validateCSRFToken,
  getCSRFTokenFromCookie,
  setCSRFTokenCookie,
  setupCSRFForForms,
  setupDoubleSubmitCookie,
  addCSRFToRequest,
  useCSRFToken
} from './csrf-protection';

// Rate Limiting
export {
  rateLimiter,
  createRateLimiter,
  initializeRateLimiter,
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  useRateLimiter
} from './rate-limiting';


// Initialize all security features
export const initializeSecurity = () => {
  // Set up CSP reporting
  if (typeof window !== 'undefined') {
    import('./csp').then(({ setupCSPReporting, applyCSPMetaTag }) => {
      setupCSPReporting();
      
      // Apply CSP meta tag for additional client-side protection
      // @ts-ignore - Safari might not support import.meta.env
      const isProduction = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'production';
      if (isProduction) {
        applyCSPMetaTag();
      }
    });

    // Set up CSRF protection for forms
    import('./csrf-protection').then(({ setupCSRFForForms, setupDoubleSubmitCookie }) => {
      setupCSRFForForms();
      setupDoubleSubmitCookie();
    });

    // Set up rate limiting
    import('./rate-limiting').then(({ initializeRateLimiter }) => {
      initializeRateLimiter();
    });
  }
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

// Security React hooks
export { useCSRFToken } from './csrf-protection';
export { useSanitizedInput } from './xss-protection';
export { useRateLimiter } from './rate-limiting';

// Security components
export { SafeHTML } from '../components/security/SafeHTML';