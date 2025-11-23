/**
 * Rate Limiting Implementation
 * Prevents abuse by limiting the frequency of operations
 */

interface RateLimitContext {
  ip?: string;
  email?: string;
  userId?: string;
  fileType?: string;
  [key: string]: unknown;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (context?: RateLimitContext) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

interface RateLimitControls {
  check: (context?: RateLimitContext) => RateLimitResult;
  consume: (context?: RateLimitContext, success?: boolean) => boolean;
  reset: (context?: RateLimitContext) => void;
}

interface ExpressLikeRequest extends RateLimitContext {
  ip?: string;
}

interface ExpressLikeResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ExpressLikeResponse;
  json(body: unknown): void;
}

type NextFunction = (err?: unknown) => void;

class RateLimiter {
  private limits: Map<string, Map<string, RateLimitEntry>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Create a rate limiter for a specific operation
   */
  createLimiter(name: string, config: RateLimitConfig): RateLimitControls {
    const {
      maxRequests,
      windowMs,
      keyGenerator = () => 'global',
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = config;

    return {
      /**
       * Check if the operation is allowed
       */
      check: (context?: RateLimitContext): RateLimitResult => {
        const key = keyGenerator(context);
        const now = Date.now();
        
        // Get or create limit map for this operation
        if (!this.limits.has(name)) {
          this.limits.set(name, new Map());
        }
        
        const limitMap = this.limits.get(name)!;
        let entry = limitMap.get(key);
        
        // Create new entry if doesn't exist or window has passed
        if (!entry || now > entry.resetTime) {
          entry = {
            count: 0,
            resetTime: now + windowMs,
            firstRequest: now
          };
          limitMap.set(key, entry);
        }
        
        const remaining = Math.max(0, maxRequests - entry.count);
        const allowed = entry.count < maxRequests;
        
        return {
          allowed,
          remaining,
          resetTime: entry.resetTime
        };
      },

      /**
       * Consume a request
       */
      consume: (context?: RateLimitContext, success: boolean = true): boolean => {
        if ((success && skipSuccessfulRequests) || (!success && skipFailedRequests)) {
          return true;
        }

        const key = keyGenerator(context);
        const now = Date.now();
        
        // Get or create limit map for this operation
        if (!this.limits.has(name)) {
          this.limits.set(name, new Map());
        }
        
        const limitMap = this.limits.get(name)!;
        let entry = limitMap.get(key);
        
        // Create new entry if doesn't exist or window has passed
        if (!entry || now > entry.resetTime) {
          entry = {
            count: 0,
            resetTime: now + windowMs,
            firstRequest: now
          };
          limitMap.set(key, entry);
        }
        
        const allowed = entry.count < maxRequests;
        
        if (allowed) {
          entry.count++;
          return true;
        }
        
        return false;
      },

      /**
       * Reset limits for a specific key
       */
      reset: (context?: RateLimitContext) => {
        const key = keyGenerator(context);
        const limitMap = this.limits.get(name);
        if (limitMap) {
          limitMap.delete(key);
        }
      }
    };
  }

  /**
   * Start cleanup interval to remove expired entries
   */
  private startCleanup() {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      this.limits.forEach((limitMap) => {
        const keysToDelete: string[] = [];
        
        limitMap.forEach((entry, key) => {
          if (now > entry.resetTime) {
            keysToDelete.push(key);
          }
        });
        
        keysToDelete.forEach(key => limitMap.delete(key));
      });
    }, 60000);
  }

  /**
   * Stop the cleanup interval
   */
  destroy() {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Pre-configured rate limiters for common operations
export const rateLimiters = {
  // API calls - 100 requests per minute
  api: rateLimiter.createLimiter('api', {
    maxRequests: 100,
    windowMs: 60 * 1000,
    keyGenerator: () => 'user' // Could be enhanced to use user ID
  }),

  // Login attempts - 5 attempts per 15 minutes
  login: rateLimiter.createLimiter('login', {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    keyGenerator: (context) => context?.email || context?.ip || 'global',
    skipSuccessfulRequests: true
  }),

  // Transaction creation - 30 per minute
  createTransaction: rateLimiter.createLimiter('createTransaction', {
    maxRequests: 30,
    windowMs: 60 * 1000
  }),

  // Bulk operations - 10 per 5 minutes
  bulkOperation: rateLimiter.createLimiter('bulkOperation', {
    maxRequests: 10,
    windowMs: 5 * 60 * 1000
  }),

  // Export operations - 20 per hour
  export: rateLimiter.createLimiter('export', {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000
  }),

  // Search - 60 per minute
  search: rateLimiter.createLimiter('search', {
    maxRequests: 60,
    windowMs: 60 * 1000
  }),

  // File upload - 50 per hour
  upload: rateLimiter.createLimiter('upload', {
    maxRequests: 50,
    windowMs: 60 * 60 * 1000,
    keyGenerator: (context) => context?.fileType || 'global'
  })
};

/**
 * React hook for rate limiting
 */
export const useRateLimiter = (limiterName: keyof typeof rateLimiters) => {
  const limiter = rateLimiters[limiterName];

  return {
    check: (context?: RateLimitContext) => limiter.check(context),
    checkAndConsume: (context?: RateLimitContext): boolean => {
      const result = limiter.check(context);
      if (result.allowed) {
        limiter.consume(context);
        return true;
      }
      return false;
    },
    reset: (context?: RateLimitContext) => limiter.reset(context)
  };
};

/**
 * Middleware for Express/Node.js
 */
export const createRateLimitMiddleware = (
  limiterName: string,
  config: RateLimitConfig,
  options?: {
    message?: string;
    statusCode?: number;
    headers?: boolean;
    keyGenerator?: (req: ExpressLikeRequest) => string;
  }
) => {
  const limiter = rateLimiter.createLimiter(limiterName, {
    ...config,
    keyGenerator: options?.keyGenerator || ((req) => req.ip || 'unknown')
  });

  return (req: ExpressLikeRequest, res: ExpressLikeResponse, next: NextFunction) => {
    const result = limiter.check(req);

    if (options?.headers !== false) {
      res.setHeader('X-RateLimit-Limit', String(config.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
    }

    if (!result.allowed) {
      res.status(options?.statusCode || 429).json({
        error: options?.message || 'Too many requests, please try again later.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
      return;
    }

    limiter.consume(req);
    next();
  };
};

/**
 * Decorator for rate limiting class methods
 */
export function RateLimit(limiterName: keyof typeof rateLimiters) {
  return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown | Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const limiter = rateLimiters[limiterName];
      const result = limiter.check();

      if (!result.allowed) {
        throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`);
      }

      try {
        const response = await originalMethod.apply(this, args);
        limiter.consume(undefined, true);
        return response;
      } catch (error) {
        limiter.consume(undefined, false);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Initialize rate limiter
 */
export const initializeRateLimiter = () => {
  // Add global API interceptor for fetch
  const originalFetch = window.fetch;
  
  window.fetch = async function (this: typeof window, ...args: Parameters<typeof window.fetch>) {
    const [url, _options] = args;
    
    // Check if this is an API call (but exclude external APIs like Stripe/Supabase/backend)
    const isApiCall = typeof url === 'string' && (
      url.startsWith('/api/') || 
      (url.includes('/api/') && !url.includes('localhost:3000') && !url.includes('supabase') && !url.includes('stripe'))
    );
    
    if (isApiCall) {
      const result = rateLimiters.api.check();
      
      if (!result.allowed) {
        throw new Error(`API rate limit exceeded. ${result.remaining} requests remaining. Reset at ${new Date(result.resetTime).toLocaleTimeString()}`);
      }
      
      rateLimiters.api.consume();
    }
    
    return originalFetch.apply(this, args);
  };
};

/**
 * Get rate limit status for all limiters
 */
export const getRateLimitStatus = () => {
  const status: Record<string, { allowed: boolean; remaining: number; resetTime: string; resetIn: number }> = {};
  
  Object.entries(rateLimiters).forEach(([name, limiter]) => {
    const result = limiter.check();
    status[name] = {
      allowed: result.allowed,
      remaining: result.remaining,
      resetTime: new Date(result.resetTime).toISOString(),
      resetIn: Math.max(0, Math.ceil((result.resetTime - Date.now()) / 1000))
    };
  });
  
  return status;
};

export default rateLimiter;
