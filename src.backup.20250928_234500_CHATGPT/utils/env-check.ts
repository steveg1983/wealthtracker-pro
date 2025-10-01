// Environment variable checker for debugging
import { logger } from '../services/loggingService';

export function checkEnvironmentVariables() {
  const envVars = {
    VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
    MODE: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV,
  };

  logger.info('Environment Variables Check:');
  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      // Don't log full keys for security, just first few chars
      const displayValue = typeof value === 'string' && value.length > 10 
        ? `${value.substring(0, 10)}...` 
        : value;
      logger.info('Env ok', { key, value: displayValue });
    } else {
      logger.warn('Env missing', { key });
    }
  });

  return envVars;
}
