import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('Environment');
/**
 * Professional-grade environment configuration
 * Centralizes all environment-specific settings
 * No hardcoded URLs - everything is properly configured
 */

export const environment = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  isTest: import.meta.env.MODE === 'test',
  
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_URL || window.location.origin,
    timeout: 30000,
    retryAttempts: 3,
  },
  
  // Frontend URLs
  frontend: {
    baseUrl: import.meta.env.VITE_FRONTEND_URL || window.location.origin,
    port: import.meta.env.VITE_PORT || '5173',
  },
  
  // Supabase Configuration
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  
  // Clerk Configuration
  clerk: {
    publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '',
    signInUrl: '/login',
    signUpUrl: '/register',
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/onboarding',
  },
  
  // Plaid Configuration
  plaid: {
    publicKey: import.meta.env.VITE_PLAID_PUBLIC_KEY || '',
    environment: import.meta.env.VITE_PLAID_ENV || 'sandbox',
  },
  
  // Stripe Configuration
  stripe: {
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  },
  
  // Security Configuration
  security: {
    corsOrigins: (import.meta.env.VITE_CORS_ORIGINS || '').split(',').filter(Boolean),
    cspReportUri: import.meta.env.VITE_CSP_REPORT_URI || '',
    enableCSRF: import.meta.env.VITE_ENABLE_CSRF !== 'false',
    enableRateLimiting: import.meta.env.VITE_ENABLE_RATE_LIMITING !== 'false',
  },
  
  // Feature Flags
  features: {
    enablePWA: import.meta.env.VITE_ENABLE_PWA !== 'false',
    enableOfflineMode: import.meta.env.VITE_ENABLE_OFFLINE !== 'false',
    enableRealtime: import.meta.env.VITE_ENABLE_REALTIME !== 'false',
    enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    enableDebugMode: import.meta.env.VITE_DEBUG === 'true',
  },
  
  // Service Worker Configuration
  serviceWorker: {
    enabled: import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW === 'true',
    updateInterval: 60000, // Check for updates every minute
    scope: '/',
  },
};

// Helper functions
export const isLocalhost = (): boolean => {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]' ||
    // Consider localhost IPv4 range
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/) !== null
  );
};

export const getApiUrl = (path: string = ''): string => {
  const base = environment.api.baseUrl;
  return path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base;
};

export const getFrontendUrl = (path: string = ''): string => {
  const base = environment.frontend.baseUrl;
  return path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base;
};

export const getCorsOrigins = (): string[] => {
  const origins = [...environment.security.corsOrigins];
  
  // Add current origin if not already included
  const currentOrigin = window.location.origin;
  if (!origins.includes(currentOrigin)) {
    origins.push(currentOrigin);
  }
  
  return origins;
};

// Validate required environment variables
export const validateEnvironment = (): void => {
  const required: Array<[string, string | undefined]> = [];
  
  if (environment.isProduction) {
    required.push(
      ['VITE_SUPABASE_URL', environment.supabase.url],
      ['VITE_SUPABASE_ANON_KEY', environment.supabase.anonKey],
      ['VITE_CLERK_PUBLISHABLE_KEY', environment.clerk.publishableKey],
    );
  }
  
  const missing = required.filter(([_, value]) => !value).map(([name]) => name);
  
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    if (environment.isProduction) {
      throw new Error('Application cannot start: missing required configuration');
    }
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  validateEnvironment();
}
