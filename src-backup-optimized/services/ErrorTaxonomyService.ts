/**
 * Error Taxonomy Service - Phase 5
 * Comprehensive error classification and user-facing message system
 * Implements the ERROR_TAXONOMY.md architecture
 */

import { lazyLogger as logger } from './serviceFactory';
import { captureException } from '../lib/sentry';

// Error Categories from ERROR_TAXONOMY.md
export const ErrorCategory = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  STORAGE: 'storage',
  CALCULATION: 'calculation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  INTEGRATION: 'integration',
  FINANCIAL: 'financial', // Added for financial operations
  UNKNOWN: 'unknown'
} as const;

export type ErrorCategoryType = typeof ErrorCategory[keyof typeof ErrorCategory];

// Error Severity Levels
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export type ErrorSeverityType = typeof ErrorSeverity[keyof typeof ErrorSeverity];

// User-facing error interface
export interface CategorizedError {
  category: ErrorCategoryType;
  severity: ErrorSeverityType;
  userMessage: string;
  technicalMessage: string;
  errorCode: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  recoveryAction?: string;
}

// Custom error class for user-facing errors
export class UserFacingError extends Error {
  public readonly category: ErrorCategoryType;
  public readonly severity: ErrorSeverityType;
  public readonly errorCode: string;
  public readonly technicalMessage: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    userMessage: string,
    category: ErrorCategoryType,
    severity: ErrorSeverityType,
    technicalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(userMessage);
    this.name = 'UserFacingError';
    this.category = category;
    this.severity = severity;
    this.errorCode = `${category.toUpperCase()}_${Date.now()}`;
    this.technicalMessage = technicalError?.message || userMessage;
    this.context = context;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UserFacingError);
    }
  }
}

/**
 * Comprehensive Error Taxonomy Service
 */
export class ErrorTaxonomyService {
  private errorHistory: CategorizedError[] = [];
  private readonly maxHistorySize = 100;

  /**
   * Categorize an error automatically based on type and message
   */
  categorizeError(error: Error): ErrorCategoryType {
    const message = error.message.toLowerCase();
    const errorType = error.constructor.name;

    // Network errors
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('connection') ||
      errorType === 'NetworkError'
    ) {
      return ErrorCategory.NETWORK;
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      errorType === 'ValidationError' ||
      errorType.includes('ZodError')
    ) {
      return ErrorCategory.VALIDATION;
    }

    // Storage errors
    if (
      message.includes('storage') ||
      message.includes('quota') ||
      message.includes('indexeddb') ||
      message.includes('localstorage')
    ) {
      return ErrorCategory.STORAGE;
    }

    // Calculation errors
    if (
      message.includes('calculation') ||
      message.includes('division') ||
      message.includes('decimal') ||
      message.includes('overflow')
    ) {
      return ErrorCategory.CALCULATION;
    }

    // Authentication errors
    if (
      message.includes('authentication') ||
      message.includes('login') ||
      message.includes('session') ||
      message.includes('unauthorized')
    ) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Financial errors
    if (
      message.includes('transaction') ||
      message.includes('account') ||
      message.includes('balance') ||
      message.includes('budget') ||
      message.includes('financial')
    ) {
      return ErrorCategory.FINANCIAL;
    }

    // Integration errors
    if (
      message.includes('supabase') ||
      message.includes('stripe') ||
      message.includes('plaid') ||
      message.includes('webhook')
    ) {
      return ErrorCategory.INTEGRATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine error severity automatically
   */
  determineSeverity(error: Error, category: ErrorCategoryType): ErrorSeverityType {
    const message = error.message.toLowerCase();

    // Critical financial operations
    if (category === ErrorCategory.FINANCIAL) {
      if (message.includes('balance') || message.includes('transaction')) {
        return ErrorSeverity.HIGH;
      }
    }

    // Critical authentication
    if (category === ErrorCategory.AUTHENTICATION) {
      return ErrorSeverity.HIGH;
    }

    // Critical storage
    if (category === ErrorCategory.STORAGE && message.includes('quota')) {
      return ErrorSeverity.CRITICAL;
    }

    // Network issues are generally medium (app works offline)
    if (category === ErrorCategory.NETWORK) {
      return ErrorSeverity.MEDIUM;
    }

    // Validation errors are generally low severity
    if (category === ErrorCategory.VALIDATION) {
      return ErrorSeverity.LOW;
    }

    return ErrorSeverity.MEDIUM;
  }

  /**
   * Get user-friendly message for an error
   */
  getUserMessage(error: Error, category: ErrorCategoryType): string {
    const message = error.message.toLowerCase();

    // Network errors
    if (category === ErrorCategory.NETWORK) {
      if (message.includes('fetch')) {
        return "The app is running in local-only mode. All data is stored in your browser.";
      }
      return "Network connection error. The app will continue to work offline.";
    }

    // Validation errors
    if (category === ErrorCategory.VALIDATION) {
      if (message.includes('date')) {
        return "Please enter a valid date (MM/DD/YYYY or YYYY-MM-DD format)";
      }
      if (message.includes('amount') && message.includes('positive')) {
        return "Please enter a positive amount";
      }
      if (message.includes('required')) {
        return "This field is required";
      }
      return "Please check your input and try again";
    }

    // Storage errors
    if (category === ErrorCategory.STORAGE) {
      if (message.includes('quota')) {
        return "Storage space is full. Please free up browser storage or export your data.";
      }
      return "Unable to save data. Please check your browser storage settings.";
    }

    // Financial errors
    if (category === ErrorCategory.FINANCIAL) {
      if (message.includes('transaction')) {
        return "Unable to process transaction. Please verify your data and try again.";
      }
      if (message.includes('account')) {
        return "Account operation failed. Please check your account details.";
      }
      return "Financial operation failed. Please try again or contact support.";
    }

    // Authentication errors
    if (category === ErrorCategory.AUTHENTICATION) {
      if (message.includes('session')) {
        return "Your session has expired. Please log in again.";
      }
      return "Please log in to continue";
    }

    // Integration errors
    if (category === ErrorCategory.INTEGRATION) {
      if (message.includes('supabase')) {
        return "Database connection unavailable. Running in offline mode.";
      }
      if (message.includes('stripe')) {
        return "Payment processing temporarily unavailable. Please try again later.";
      }
      return "External service temporarily unavailable. Core features remain functional.";
    }

    // Default fallback
    return "An unexpected error occurred. Please try again or contact support if the problem persists.";
  }

  /**
   * Get recovery action for an error
   */
  getRecoveryAction(error: Error, category: ErrorCategoryType): string | undefined {
    const message = error.message.toLowerCase();

    if (category === ErrorCategory.NETWORK) {
      return "Check your internet connection and try again";
    }

    if (category === ErrorCategory.VALIDATION) {
      return "Please review and correct the highlighted fields";
    }

    if (category === ErrorCategory.STORAGE) {
      return "Try refreshing the page or clearing browser data";
    }

    if (category === ErrorCategory.FINANCIAL) {
      return "Verify all amounts and account details before retrying";
    }

    if (category === ErrorCategory.AUTHENTICATION) {
      return "Please log out and log back in";
    }

    return "Try refreshing the page or contact support";
  }

  /**
   * Process and categorize an error
   */
  processError(
    error: Error,
    context?: Record<string, unknown>
  ): CategorizedError {
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, category);
    const userMessage = this.getUserMessage(error, category);
    const recoveryAction = this.getRecoveryAction(error, category);

    const categorizedError: CategorizedError = {
      category,
      severity,
      userMessage,
      technicalMessage: error.message,
      errorCode: `${category.toUpperCase()}_${Date.now()}`,
      timestamp: new Date(),
      context,
      recoveryAction
    };

    // Add to history
    this.addToHistory(categorizedError);

    // Log based on severity
    this.logError(categorizedError, error);

    // Send to monitoring (Sentry) for high/critical errors
    if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
      captureException(error, {
        tags: {
          category,
          severity,
          errorCode: categorizedError.errorCode
        },
        contexts: {
          errorDetails: {
            userMessage,
            recoveryAction,
            context
          }
        }
      });
    }

    return categorizedError;
  }

  /**
   * Create a user-facing error from any error
   */
  createUserFacingError(
    error: Error,
    context?: Record<string, unknown>
  ): UserFacingError {
    const categorized = this.processError(error, context);
    return new UserFacingError(
      categorized.userMessage,
      categorized.category,
      categorized.severity,
      error,
      context
    );
  }

  /**
   * Get error history for debugging
   */
  getErrorHistory(): CategorizedError[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byCategory: Record<ErrorCategoryType, number>;
    bySeverity: Record<ErrorSeverityType, number>;
  } {
    const byCategory = Object.values(ErrorCategory).reduce(
      (acc, cat) => ({ ...acc, [cat]: 0 }),
      {} as Record<ErrorCategoryType, number>
    );

    const bySeverity = Object.values(ErrorSeverity).reduce(
      (acc, sev) => ({ ...acc, [sev]: 0 }),
      {} as Record<ErrorSeverityType, number>
    );

    this.errorHistory.forEach(err => {
      byCategory[err.category]++;
      bySeverity[err.severity]++;
    });

    return {
      total: this.errorHistory.length,
      byCategory,
      bySeverity
    };
  }

  private addToHistory(error: CategorizedError): void {
    this.errorHistory.push(error);

    // Keep history size manageable
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  private logError(categorizedError: CategorizedError, originalError: Error): void {
    const logData = {
      errorCode: categorizedError.errorCode,
      category: categorizedError.category,
      severity: categorizedError.severity,
      userMessage: categorizedError.userMessage,
      technicalMessage: categorizedError.technicalMessage,
      context: categorizedError.context,
      recoveryAction: categorizedError.recoveryAction,
      originalError: {
        name: originalError.name,
        message: originalError.message,
        stack: originalError.stack
      }
    };

    switch (categorizedError.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('HIGH SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('MEDIUM SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('LOW SEVERITY ERROR:', logData);
        break;
    }
  }
}

// Export singleton instance
export const errorTaxonomyService = new ErrorTaxonomyService();

// Export convenience functions
export function categorizeError(error: Error, context?: Record<string, unknown>): CategorizedError {
  return errorTaxonomyService.processError(error, context);
}

export function createUserFriendlyError(error: Error, context?: Record<string, unknown>): UserFacingError {
  return errorTaxonomyService.createUserFacingError(error, context);
}

// Types and classes are already exported above