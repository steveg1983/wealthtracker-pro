/**
 * Content Security Policy (CSP) configuration
 * Implements security headers to prevent XSS, clickjacking, and other attacks
 */

// Generate a nonce for inline scripts (for development)
export const generateNonce = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
};

// Helper to detect development mode (browser + Safari-safe)
const isDevMode = (() => {
  try {
    // @ts-ignore - Safari compatibility
    return typeof import.meta !== 'undefined' && import.meta.env?.MODE !== 'production';
  } catch {
    return false;
  }
})();

// CSP directives configuration
export const getCSPDirectives = (nonce?: string): Record<string, string[]> => {
  const directives: Record<string, string[]> = {
    // Default policy for all resources
    'default-src': ["'self'"],
    
    // Scripts: self, inline with nonce (for Vite), and trusted CDNs
    'script-src': [
      "'self'",
      nonce ? `'nonce-${nonce}'` : '',
      // Remove 'strict-dynamic' as it blocks our lazy-loaded modules
      // "'strict-dynamic'", // This was blocking dynamic imports
      'https:', // For CDNs in production
      // @ts-ignore - Safari compatibility
      (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'development') ? "'unsafe-inline'" : '', // Only for dev
      isDevMode ? "'unsafe-eval'" : '', // Avoid unsafe-eval in production
    ].filter(Boolean),
    
    // Styles: self, inline (for styled components), and trusted CDNs
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for inline styles and styled-components
      'https://fonts.googleapis.com',
    ],
    
    // Images: self, data URIs (for inline images), and https
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https:',
      'https://logo.clearbit.com', // Logo service
    ],
    
    // Fonts: self and Google Fonts
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
    ],
    
    // Connect: self and API endpoints
    'connect-src': [
      "'self'",
      'ws:', // WebSocket for Vite HMR
      'wss:',
      'https://api.exchangerate-api.com', // Exchange rate API
      'https://cdn.jsdelivr.net', // CDN for libraries
      'https://*.clerk.accounts.dev', // Clerk authentication
      'https://clerk.com',
      'https://*.clerk.com',
      'https://api.stripe.com', // Stripe payments
      'https://*.supabase.co', // Supabase backend
      'https://supabase.co',
    ],
    
    // Media: self and blob (for generated content)
    'media-src': [
      "'self'",
      'blob:',
    ],
    
    // Objects: none (no plugins)
    'object-src': ["'none'"],
    
    // Frame ancestors: none (prevent clickjacking)
    'frame-ancestors': ["'none'"],
    
    // Frame sources: self and Stripe
    'frame-src': [
      "'self'",
      'https://js.stripe.com',
      'https://hooks.stripe.com',
    ],
    
    // Worker sources: self and blob for service workers
    'worker-src': [
      "'self'",
      'blob:',
    ],
    
    // Base URI: self only
    'base-uri': ["'self'"],
    
    // Form action: self only
    'form-action': ["'self'"],
    
    // Upgrade insecure requests
    'upgrade-insecure-requests': [],
    
    // Block all mixed content
    'block-all-mixed-content': [],
  };

  // Remove empty directives
  Object.keys(directives).forEach(key => {
    if (directives[key].length === 0) {
      delete directives[key];
    }
  });

  return directives;
};

// Convert directives to CSP header string
export const getCSPHeader = (nonce?: string): string => {
  const directives = getCSPDirectives(nonce);
  
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
};

// Security headers configuration
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    // Prevent XSS attacks
    'X-XSS-Protection': '1; mode=block',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Enable HSTS (HTTP Strict Transport Security)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions policy (replaces Feature-Policy)
    'Permissions-Policy': [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
    ].join(', '),
  };
};

// Apply CSP meta tag to document (for client-side enforcement)
export const applyCSPMetaTag = (): void => {
  if (typeof document === 'undefined') return;
  
  // Remove any existing CSP meta tags
  const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (existingCSP) {
    existingCSP.remove();
  }

  // Create new CSP meta tag
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = getCSPHeader();
  document.head.appendChild(meta);
};

import { captureMessage } from '../lib/sentry';
import { lazyLogger as logger } from '../services/serviceFactory';

// Check for CSP violations and report them
export const setupCSPReporting = (): void => {
  if (typeof window !== 'undefined' && 'SecurityPolicyViolationEvent' in window && typeof document !== 'undefined') {
    document.addEventListener('securitypolicyviolation', (e: SecurityPolicyViolationEvent) => {
      logger.error('CSP Violation:', {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        originalPolicy: e.originalPolicy,
        disposition: e.disposition,
        documentURI: e.documentURI,
        effectiveDirective: e.effectiveDirective,
        lineNumber: e.lineNumber,
        columnNumber: e.columnNumber,
        sourceFile: e.sourceFile,
        statusCode: e.statusCode,
      });

      // In production, you might want to send this to a logging service
      // @ts-ignore - Safari compatibility
      const isProduction = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'production';
      if (isProduction) {
        try {
          captureMessage('CSP Violation', 'warning', {
            blockedURI: e.blockedURI,
            violatedDirective: e.violatedDirective,
            originalPolicy: e.originalPolicy,
            disposition: e.disposition,
            documentURI: e.documentURI,
            effectiveDirective: e.effectiveDirective,
            lineNumber: String(e.lineNumber),
            columnNumber: String(e.columnNumber),
            sourceFile: e.sourceFile,
            statusCode: String(e.statusCode),
          });
        } catch {
          // Swallow any reporting issues to avoid cascading failures
        }
      }
    });
  }
};

// Vite plugin configuration helper
export const viteCSPPlugin = () => {
  return {
    name: 'csp-header',
    configureServer(server: any) {
      server.middlewares.use((_req: any, res: any, next: any) => {
        const nonce = generateNonce();
        const cspHeader = getCSPHeader(nonce);
        const securityHeaders = getSecurityHeaders();

        // Set CSP header
        res.setHeader('Content-Security-Policy', cspHeader);
        
        // Set other security headers
        Object.entries(securityHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Store nonce for use in HTML
        res.locals = res.locals || {};
        res.locals.nonce = nonce;

        next();
      });
    },
  };
};

// Express/Node.js middleware for production
export const cspMiddleware = (_req: any, res: any, next: any) => {
  const nonce = generateNonce();
  const cspHeader = getCSPHeader(nonce);
  const securityHeaders = getSecurityHeaders();

  // Set CSP header
  res.setHeader('Content-Security-Policy', cspHeader);
  
  // Set other security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Make nonce available to templates
  res.locals.nonce = nonce;

  next();
};
