// Centralized Error Handling Service
// Provides consistent error handling, logging, and user notifications

import { isLocalhost } from '../config/environment';
import { logger } from './loggingService';

const errorSeverityValues = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

const errorCategoryValues = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  STORAGE: 'storage',
  CALCULATION: 'calculation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  INTEGRATION: 'integration',
  UNKNOWN: 'unknown'
} as const;

export type ErrorSeverity = typeof errorSeverityValues[keyof typeof errorSeverityValues];
export const ErrorSeverity = errorSeverityValues;

export type ErrorCategory = typeof errorCategoryValues[keyof typeof errorCategoryValues];
export const ErrorCategory = errorCategoryValues;

export interface AppError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, unknown> | undefined;
  stack?: string | undefined;
  userMessage?: string | undefined;
  recoverable: boolean;
  retryable: boolean;
}

export interface ErrorHandler {
  (error: AppError): void | Promise<void>;
}

class ErrorHandlingService {
  private errors: AppError[] = [];
  private handlers: Map<ErrorCategory, ErrorHandler[]> = new Map();
  private maxErrors = 100; // Keep last 100 errors in memory
  private storageKey = 'wealthtracker_error_log';

  constructor() {
    this.setupGlobalErrorHandlers();
    this.loadErrors();
  }

  private setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(new Error(event.reason), {
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.HIGH,
        context: { type: 'unhandledRejection' }
      });
      event.preventDefault();
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.HIGH,
        context: { 
          type: 'globalError',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });
  }

  private loadErrors() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<Omit<AppError, 'timestamp'> & { timestamp: string }>;
        this.errors = parsed.map((err) => ({
          ...err,
          timestamp: new Date(err.timestamp)
        })).slice(-this.maxErrors);
      }
    } catch (error) {
      logger.error('Failed to load error log:', error);
    }
  }

  private saveErrors() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.errors.slice(-this.maxErrors)));
    } catch (error) {
      logger.error('Failed to save error log:', error);
    }
  }

  // Main error handling method
  handleError(
    error: Error | string,
    options: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
      userMessage?: string;
      recoverable?: boolean;
      retryable?: boolean;
    } = {}
  ): AppError {
    const errorObj: AppError = {
      id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: error instanceof Error ? error.message : error,
      category: options.category || this.categorizeError(error),
      severity: options.severity || ErrorSeverity.MEDIUM,
      timestamp: new Date(),
      context: options.context,
      stack: error instanceof Error ? error.stack : undefined,
      userMessage: options.userMessage || this.getUserMessage(error, options.category),
      recoverable: options.recoverable !== false,
      retryable: options.retryable || false
    };

    // Add to error log
    this.errors.push(errorObj);
    this.saveErrors();

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.error('App Error:', errorObj);
    }

    // Call registered handlers
    const handlers = this.handlers.get(errorObj.category) || [];
    handlers.forEach(handler => {
      try {
        handler(errorObj);
      } catch (err) {
        logger.error('Error in error handler:', err);
      }
    });

    return errorObj;
  }

  // Categorize error based on type and message
  private categorizeError(error: Error | string): ErrorCategory {
    const message = error instanceof Error ? error.message : error;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return ErrorCategory.NETWORK;
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (lowerMessage.includes('storage') || lowerMessage.includes('indexeddb') || lowerMessage.includes('localstorage')) {
      return ErrorCategory.STORAGE;
    }
    if (lowerMessage.includes('calculation') || lowerMessage.includes('decimal')) {
      return ErrorCategory.CALCULATION;
    }
    if (lowerMessage.includes('auth')) {
      return ErrorCategory.AUTHENTICATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  // Get user-friendly error message
  private getUserMessage(error: Error | string, category?: ErrorCategory): string {
    const baseMessage = error instanceof Error ? error.message : error;

    // Check for specific API connection errors
    if (baseMessage.toLowerCase().includes('failed to fetch') || 
        baseMessage.toLowerCase().includes('network') ||
        baseMessage.toLowerCase().includes('offline')) {
      return 'The app is running in local-only mode. All data is stored in your browser.';
    }

    switch (category) {
      case ErrorCategory.NETWORK:
        // Check if this is a local API connection issue
        if (isLocalhost()) {
          return 'No backend server detected. The app is working in local-only mode.';
        }
        return 'Network connection error. The app will continue to work offline.';
      case ErrorCategory.VALIDATION:
        return `Invalid data: ${baseMessage}`;
      case ErrorCategory.STORAGE:
        return 'Failed to save data. Please check your browser storage settings.';
      case ErrorCategory.CALCULATION:
        return 'Calculation error. Please verify your input data.';
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication required. Please log in again.';
      case ErrorCategory.AUTHORIZATION:
        return 'You don\'t have permission to perform this action.';
      case ErrorCategory.INTEGRATION:
        // Check if this is a banking API issue
        if (baseMessage.includes('bank') || baseMessage.includes('plaid')) {
          return 'Bank connection service unavailable. Manual account management is still available.';
        }
        return 'External service unavailable. Core features remain functional.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  // Register error handler for specific category
  registerHandler(category: ErrorCategory, handler: ErrorHandler) {
    if (!this.handlers.has(category)) {
      this.handlers.set(category, []);
    }
    this.handlers.get(category)!.push(handler);
  }

  // Get recent errors
  getRecentErrors(count: number = 10): AppError[] {
    return this.errors.slice(-count).reverse();
  }

  // Get errors by category
  getErrorsByCategory(category: ErrorCategory): AppError[] {
    return this.errors.filter(err => err.category === category);
  }

  // Clear error log
  clearErrors() {
    this.errors = [];
    this.saveErrors();
  }

  // Retry helper with exponential backoff
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      initialDelay?: number;
      maxDelay?: number;
      factor?: number;
      onRetry?: (attempt: number, error: Error) => void;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      factor = 2,
      onRetry
    } = options;

    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
          
          if (onRetry) {
            onRetry(attempt + 1, lastError);
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  // Create error boundary wrapper
  wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    options: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      userMessage?: string;
      fallback?: unknown;
    } = {}
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error as Error, options);
        
        if (options.fallback !== undefined) {
          return options.fallback;
        }
        
        throw error;
      }
    }) as T;
  }

  // Validation helper
  validate<T>(
    value: T,
    rules: Array<{
      test: (val: T) => boolean;
      message: string;
    }>
  ): void {
    for (const rule of rules) {
      if (!rule.test(value)) {
        throw new Error(rule.message);
      }
    }
  }
}

export const errorHandlingService = new ErrorHandlingService();

// Convenience functions
export const handleError = errorHandlingService.handleError.bind(errorHandlingService);
export const retryWithBackoff = errorHandlingService.retryWithBackoff.bind(errorHandlingService);
export const wrapAsync = errorHandlingService.wrapAsync.bind(errorHandlingService);
export const validate = errorHandlingService.validate.bind(errorHandlingService);
