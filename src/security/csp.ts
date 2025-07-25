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

// CSP directives configuration
export const getCSPDirectives = (nonce?: string): Record<string, string[]> => {
  const directives: Record<string, string[]> = {
    // Default policy for all resources
    'default-src': ["'self'"],
    
    // Scripts: self, inline with nonce (for Vite), and trusted CDNs
    'script-src': [
      "'self'",
      nonce ? `'nonce-${nonce}'` : '',
      "'strict-dynamic'", // Allow scripts loaded by trusted scripts
      'https:', // For CDNs in production
      process.env.NODE_ENV === 'development' ? "'unsafe-inline'" : '', // Only for dev
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

// Check for CSP violations and report them
export const setupCSPReporting = (): void => {
  if ('SecurityPolicyViolationEvent' in window) {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error('CSP Violation:', {
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
      if (process.env.NODE_ENV === 'production') {
        // Example: Send to logging service
        // logService.logCSPViolation({...});
      }
    });
  }
};

// Vite plugin configuration helper
export const viteCSPPlugin = () => {
  return {
    name: 'csp-header',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
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
export const cspMiddleware = (req: any, res: any, next: any) => {
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