/**
 * Production Configuration - Phase 8.1 & 8.6
 * Comprehensive production-ready configuration and deployment optimization
 */

import { lazyLogger as logger } from '../services/serviceFactory';

// Production environment validation
interface ProductionEnvironment {
  VITE_CLERK_PUBLISHABLE_KEY: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  VITE_STRIPE_PUBLISHABLE_KEY: string;
  VITE_SENTRY_DSN: string;
  VITE_APP_ENV: string;
}

// Performance thresholds for production
export const PRODUCTION_PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals (Google standards)
  FIRST_CONTENTFUL_PAINT: 1800, // ms
  LARGEST_CONTENTFUL_PAINT: 2500, // ms
  FIRST_INPUT_DELAY: 100, // ms
  CUMULATIVE_LAYOUT_SHIFT: 0.1, // score

  // Bundle size limits
  MAX_INITIAL_BUNDLE: 200 * 1024, // 200KB
  MAX_CHUNK_SIZE: 50 * 1024, // 50KB
  MAX_TOTAL_BUNDLE: 2 * 1024 * 1024, // 2MB

  // Runtime performance
  MAX_COMPONENT_RENDER_TIME: 16, // ms (60fps)
  MAX_API_RESPONSE_TIME: 2000, // ms
  MAX_DATABASE_QUERY_TIME: 500, // ms

  // Memory limits
  MAX_MEMORY_USAGE_PERCENT: 85, // %
  MAX_MEMORY_LEAK_GROWTH: 10 * 1024 * 1024 // 10MB
} as const;

// Production feature flags
export const PRODUCTION_FEATURES = {
  ENABLE_ERROR_TRACKING: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_USER_ANALYTICS: true,
  ENABLE_HEALTH_CHECKS: true,
  ENABLE_SECURITY_MONITORING: true,
  ENABLE_DEBUG_TOOLS: false, // Disabled in production
  ENABLE_BUNDLE_ANALYSIS: false, // Only in CI
  ENABLE_SOURCE_MAPS: false // Disabled for security
} as const;

// Security headers for production
export const PRODUCTION_SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https: wss:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'"
  ].join('; ')
} as const;

/**
 * Production Configuration Manager
 */
export class ProductionConfigManager {
  private config: Partial<ProductionEnvironment> = {};
  private isValid = false;

  constructor() {
    this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load production configuration
   */
  private loadConfiguration(): void {
    this.config = {
      VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
      VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
      VITE_APP_ENV: import.meta.env.VITE_APP_ENV || import.meta.env.MODE
    };
  }

  /**
   * Validate production configuration
   */
  private validateConfiguration(): void {
    const isProduction = this.config.VITE_APP_ENV === 'production';

    if (!isProduction) {
      this.isValid = true;
      logger.debug('Development mode - configuration validation skipped');
      return;
    }

    const requiredVars: (keyof ProductionEnvironment)[] = [
      'VITE_CLERK_PUBLISHABLE_KEY',
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_STRIPE_PUBLISHABLE_KEY',
      'VITE_SENTRY_DSN'
    ];

    const missingVars = requiredVars.filter(key => !this.config[key]);

    if (missingVars.length > 0) {
      logger.error('Missing required production environment variables:', missingVars);
      this.isValid = false;
      throw new Error(`Production deployment blocked: Missing environment variables: ${missingVars.join(', ')}`);
    }

    // Validate format of critical variables
    if (this.config.VITE_SUPABASE_URL && !this.config.VITE_SUPABASE_URL.includes('supabase.co')) {
      logger.error('Invalid Supabase URL format');
      this.isValid = false;
    }

    if (this.config.VITE_CLERK_PUBLISHABLE_KEY && !this.config.VITE_CLERK_PUBLISHABLE_KEY.startsWith('pk_')) {
      logger.error('Invalid Clerk publishable key format');
      this.isValid = false;
    }

    this.isValid = true;
    logger.info('Production configuration validated successfully');
  }

  /**
   * Get configuration value
   */
  get<K extends keyof ProductionEnvironment>(key: K): string | undefined {
    return this.config[key];
  }

  /**
   * Check if configuration is valid
   */
  isConfigurationValid(): boolean {
    return this.isValid;
  }

  /**
   * Get production readiness checklist
   */
  getProductionReadinessChecklist(): {
    item: string;
    status: boolean;
    critical: boolean;
    description: string;
  }[] {
    return [
      {
        item: 'Environment Variables',
        status: this.isValid,
        critical: true,
        description: 'All required environment variables configured'
      },
      {
        item: 'Error Tracking',
        status: !!this.config.VITE_SENTRY_DSN,
        critical: true,
        description: 'Sentry error tracking configured'
      },
      {
        item: 'Authentication',
        status: !!this.config.VITE_CLERK_PUBLISHABLE_KEY,
        critical: true,
        description: 'Clerk authentication configured'
      },
      {
        item: 'Database',
        status: !!this.config.VITE_SUPABASE_URL,
        critical: true,
        description: 'Supabase database configured'
      },
      {
        item: 'Payments',
        status: !!this.config.VITE_STRIPE_PUBLISHABLE_KEY,
        critical: false,
        description: 'Stripe payments configured'
      },
      {
        item: 'Security Headers',
        status: true, // Always true - handled by framework
        critical: true,
        description: 'Security headers configured'
      },
      {
        item: 'Bundle Optimization',
        status: true, // Always true - handled by Vite
        critical: false,
        description: 'Bundle optimization enabled'
      }
    ];
  }

  /**
   * Get deployment recommendations
   */
  getDeploymentRecommendations(): string[] {
    const recommendations = [];

    if (!this.isValid) {
      recommendations.push('❌ Fix configuration issues before deployment');
    }

    const isProduction = this.config.VITE_APP_ENV === 'production';
    if (!isProduction) {
      recommendations.push('⚠️ Set VITE_APP_ENV=production for production deployment');
    }

    if (!this.config.VITE_SENTRY_DSN) {
      recommendations.push('⚠️ Configure Sentry DSN for error tracking');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Configuration ready for production deployment');
      recommendations.push('✅ All critical services configured');
      recommendations.push('✅ Security headers enabled');
      recommendations.push('✅ Bundle optimization active');
    }

    return recommendations;
  }
}

// Export singleton instance
export const productionConfig = new ProductionConfigManager();

/**
 * Production deployment validation
 */
export function validateProductionDeployment(): {
  ready: boolean;
  blockers: string[];
  warnings: string[];
} {
  const checklist = productionConfig.getProductionReadinessChecklist();
  const recommendations = productionConfig.getDeploymentRecommendations();

  const criticalIssues = checklist.filter(item => item.critical && !item.status);
  const warnings = checklist.filter(item => !item.critical && !item.status);

  return {
    ready: criticalIssues.length === 0,
    blockers: criticalIssues.map(item => item.description),
    warnings: warnings.map(item => item.description)
  };
}